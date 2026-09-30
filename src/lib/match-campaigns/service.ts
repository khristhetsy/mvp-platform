/**
 * Match campaigns: data access and the campaign lifecycle (check → match → send →
 * results). Server only. Every admin route authorizes before calling in here.
 *
 * Matching runs the /fit ranker (the same one behind icapos.com/fit) over the investor
 * index, so a founder sees the same kind of match here as on /fit. Weights are not
 * touched. Investors are never emailed by this feature.
 */
import "server-only";
import { marketingDb } from "@/lib/marketing/db";
import { makeUnsubscribeToken, sendMarketingEmail, emailConfigured } from "@/lib/marketing/send";
import { marketingSendEnabled } from "@/lib/marketing/campaigns";
import { absoluteUrl } from "@/lib/activity/email-templates";
import { scorablesForIndustries } from "@/lib/fit/match-index";
import { rankScorables } from "@/lib/fit/match-investors";
import type { Scorable } from "@/lib/fit/match-investors";
import { emailDispatchAllowedForUser } from "@/lib/organizations/organizations";
import {
  excludedReason,
  firstEmail,
  founderToFitAnswers,
  nonEmpty,
  networkLabel,
  readMatchConfig,
  displayStage,
  usesGuessedValue,
  sourceTag,
  type ExcludedReason,
  type FounderExtra,
  type FounderFields,
  type MatchConfig,
  type SourceKey,
  type TopMatch,
} from "./core";
import { renderMatchEmail } from "./email";
import { makeMatchToken } from "./token";

type Row = Record<string, unknown>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;
const db = (): Db => marketingDb();

export const FIELD_COLUMNS =
  "id, name, email, email_status, suppressed, company, country, industries, funding_stages, seeking_amount, seeking_investor_types, supabase_profile_id, pipeline_stage, founder_type, industry_source, stage_source";

function chunk<T>(xs: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

// ── Campaign ───────────────────────────────────────────────────────────────────

export type MatchCampaign = {
  id: string;
  name: string;
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
  from_name: string;
  from_email: string;
  reply_to: string | null;
  stat_sent: number;
  stat_opened: number;
  stat_clicked: number;
  created_at: string;
  config: MatchConfig;
};

function toCampaign(r: Row): MatchCampaign {
  return {
    id: String(r.id),
    name: String(r.name ?? ""),
    status: String(r.status ?? "draft"),
    scheduled_at: (r.scheduled_at as string) ?? null,
    sent_at: (r.sent_at as string) ?? null,
    from_name: String(r.from_name ?? ""),
    from_email: String(r.from_email ?? ""),
    reply_to: (r.reply_to as string) ?? null,
    stat_sent: Number(r.stat_sent ?? 0),
    stat_opened: Number(r.stat_opened ?? 0),
    stat_clicked: Number(r.stat_clicked ?? 0),
    created_at: String(r.created_at ?? ""),
    config: readMatchConfig(r.match_config),
  };
}

export async function getMatchCampaign(id: string): Promise<MatchCampaign | null> {
  const { data } = await db().from("marketing_campaigns").select("*").eq("id", id).maybeSingle();
  if (!data || !(data as Row).match_config) return null;
  return toCampaign(data as Row);
}

export async function createMatchCampaign(input: { name: string; from_name: string; from_email: string; reply_to?: string | null }, createdBy: string | null): Promise<MatchCampaign> {
  const config = readMatchConfig({});
  const { data, error } = await db()
    .from("marketing_campaigns")
    .insert({
      name: input.name.trim() || "Match campaign",
      from_name: input.from_name.trim(),
      from_email: input.from_email.trim(),
      reply_to: input.reply_to?.trim() || null,
      status: "draft",
      group_type: "founder",
      department: "Marketing",
      subject_override: config.subject,
      match_config: config,
      ...(createdBy ? { created_by: createdBy } : {}),
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return toCampaign(data as Row);
}

export async function updateMatchCampaign(id: string, patch: { name?: string; from_name?: string; from_email?: string; reply_to?: string | null; config?: Partial<MatchConfig> }): Promise<MatchCampaign> {
  const cur = await getMatchCampaign(id);
  if (!cur) throw new Error("Match campaign not found");
  const config = readMatchConfig({ ...cur.config, ...(patch.config ?? {}) });
  const update: Row = { match_config: config, subject_override: config.subject, updated_at: new Date().toISOString() };
  if (patch.name !== undefined) update.name = patch.name.trim() || cur.name;
  if (patch.from_name !== undefined) update.from_name = patch.from_name.trim() || cur.from_name;
  if (patch.from_email !== undefined) update.from_email = patch.from_email.trim() || cur.from_email;
  if (patch.reply_to !== undefined) update.reply_to = patch.reply_to?.trim() || null;
  const { data, error } = await db().from("marketing_campaigns").update(update).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return toCampaign(data as Row);
}

// ── Step 2: founder list ───────────────────────────────────────────────────────

export type FounderFilter = {
  q?: string;
  founderType?: string[];
  industry?: string[];
  stage?: string[];
  source?: SourceKey[];
  listId?: string | null;
};

const SOURCE_RAW: Record<SourceKey, string[]> = {
  crm: [],
  high: ["inferred:high"],
  medium: ["inferred:medium"],
  low: ["inferred:low"],
  summary: ["derived:summary"],
  derived: ["derived:capital_sought", "derived:revenue"],
  guess: ["guess:default"],
};

async function listContactIds(listId: string): Promise<string[]> {
  const ids: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await db()
      .from("marketing_list_contacts")
      .select("contact:marketing_contacts(crm_contact_id)")
      .eq("list_id", listId)
      .range(from, from + 999);
    const rows = (data ?? []) as Array<{ contact: { crm_contact_id: string | null } | null }>;
    for (const r of rows) if (r.contact?.crm_contact_id) ids.push(r.contact.crm_contact_id);
    if (rows.length < 1000) break;
  }
  return ids;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilter(q: any, f: FounderFilter, listIds: string[] | null): any {
  if (listIds) q = q.in("id", listIds.length ? listIds.slice(0, 5000) : ["00000000-0000-0000-0000-000000000000"]);
  if (f.founderType?.length) q = q.in("founder_type", f.founderType);
  if (f.industry?.length) q = q.overlaps("industries", f.industry);
  if (f.stage?.length) q = q.overlaps("funding_stages", f.stage);
  if (f.source?.length) {
    const raws = f.source.flatMap((s) => SOURCE_RAW[s]);
    const parts: string[] = [];
    if (raws.length) {
      const inList = raws.map((r) => `"${r}"`).join(",");
      parts.push(`industry_source.in.(${inList})`, `stage_source.in.(${inList})`);
    }
    if (f.source.includes("crm")) parts.push("and(industry_source.is.null,stage_source.is.null)");
    if (parts.length) q = q.or(parts.join(","));
  }
  const term = (f.q ?? "").trim().replace(/[%,()]/g, " ").trim();
  if (term) q = q.or(`company.ilike.%${term}%,name.ilike.%${term}%,email.ilike.%${term}%,pipeline_stage.ilike.%${term}%`);
  return q;
}

export async function listFounderCandidates(f: FounderFilter, page = 0, pageSize = 50): Promise<{ rows: FounderFields[]; total: number }> {
  const listIds = f.listId ? await listContactIds(f.listId) : null;
  let q = db().from("match_campaign_founder_fields").select(FIELD_COLUMNS, { count: "exact" });
  q = applyFilter(q, f, listIds);
  const { data, count, error } = await q.order("company", { ascending: true, nullsFirst: false }).range(page * pageSize, page * pageSize + pageSize - 1);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as FounderFields[], total: count ?? 0 };
}

/** Every founder id matching a filter ("Select all N"). Capped at 20,000. */
export async function allFounderIds(f: FounderFilter): Promise<string[]> {
  const listIds = f.listId ? await listContactIds(f.listId) : null;
  const ids: string[] = [];
  for (let from = 0; from < 20_000; from += 1000) {
    let q = db().from("match_campaign_founder_fields").select("id");
    q = applyFilter(q, f, listIds);
    const { data, error } = await q.order("id").range(from, from + 999);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<{ id: string }>;
    ids.push(...rows.map((r) => r.id));
    if (rows.length < 1000) break;
  }
  return ids;
}

export async function loadFounderFields(ids: string[]): Promise<Map<string, FounderFields>> {
  const out = new Map<string, FounderFields>();
  for (const part of chunk([...new Set(ids)], 300)) {
    const { data, error } = await db().from("match_campaign_founder_fields").select(FIELD_COLUMNS).in("id", part);
    if (error) throw new Error(error.message);
    for (const r of (data ?? []) as FounderFields[]) out.set(r.id, r);
  }
  return out;
}

// ── Step 3: data check ─────────────────────────────────────────────────────────

async function unsubscribedSet(emails: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  for (const part of chunk([...new Set(emails.map((e) => e.toLowerCase()))], 300)) {
    const { data } = await db().from("marketing_unsubscribes").select("email").in("email", part);
    for (const r of (data ?? []) as Array<{ email: string }>) out.add(r.email.toLowerCase());
  }
  return out;
}

export type CheckSummary = {
  selected: number;
  ready: number;
  readyGuessed: number;
  readyUnverified: number;
  excluded: Partial<Record<ExcludedReason, number>>;
};

/** Record the selection and run the data check. Replaces an earlier unsent selection. */
export async function runDataCheck(campaignId: string, founderIds: string[]): Promise<CheckSummary> {
  const campaign = await getMatchCampaign(campaignId);
  if (!campaign) throw new Error("Match campaign not found");
  if (!["draft", "paused"].includes(campaign.status)) throw new Error("The founder list can only change before the campaign is scheduled.");

  const fields = await loadFounderFields(founderIds);
  const emails = [...fields.values()].map((f) => firstEmail(f.email)).filter((e): e is string => Boolean(e));
  const unsub = await unsubscribedSet(emails);

  // Replace the previous selection: rows not sent yet are cleared, then re-inserted.
  await db().from("match_campaign_founders").delete().eq("campaign_id", campaignId).in("send_status", ["pending", "skipped", "dry_run"]);

  const summary: CheckSummary = { selected: fields.size, ready: 0, readyGuessed: 0, readyUnverified: 0, excluded: {} };
  const rows: Row[] = [];
  for (const f of fields.values()) {
    const email = firstEmail(f.email);
    const reason = excludedReason(f, campaign.config, email ? unsub.has(email) : false);
    if (reason) summary.excluded[reason] = (summary.excluded[reason] ?? 0) + 1;
    else {
      summary.ready += 1;
      if (usesGuessedValue(f)) summary.readyGuessed += 1;
      if ((f.email_status ?? "").toLowerCase() !== "valid") summary.readyUnverified += 1;
    }
    rows.push({
      campaign_id: campaignId,
      founder_contact_id: f.id,
      email,
      company: f.company,
      industry: nonEmpty(f.industries)[0] ?? null,
      funding_stage: displayStage(f.funding_stages) || null,
      founder_type: f.founder_type,
      founder_profile_id: f.supabase_profile_id,
      excluded_reason: reason,
      send_status: reason ? "skipped" : "pending",
      match_count: 0,
      top_matches: [],
    });
  }
  for (const part of chunk(rows, 500)) {
    const { error } = await db().from("match_campaign_founders").upsert(part, { onConflict: "campaign_id,founder_contact_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }
  return summary;
}

// ── Step 4: matching ───────────────────────────────────────────────────────────

const OP_STAGE_KEYS = ["Entrepreneur operating stage?"];
const REVENUE_KEYS = ["Entrepreneur annual revenue size?"];

function listFrom(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => (Array.isArray(x) && x.length === 2 ? String(x[1]) : String(x))).map((s) => s.trim()).filter(Boolean);
  if (typeof v === "string" && v.trim()) return [v.trim()];
  return [];
}

async function loadExtras(ids: string[]): Promise<Map<string, FounderExtra>> {
  const out = new Map<string, FounderExtra>();
  for (const part of chunk(ids, 300)) {
    const { data } = await db().from("crm_contacts").select("id, overrides, profile").in("id", part);
    for (const r of (data ?? []) as Array<{ id: string; overrides: Row | null; profile: { extra?: Row } | null }>) {
      const pick = (keys: string[]) => {
        for (const k of keys) {
          const o = listFrom(r.overrides?.[k]);
          if (o.length) return o;
          const e = listFrom(r.profile?.extra?.[k]);
          if (e.length) return e;
        }
        return [];
      };
      out.set(r.id, { operatingStages: pick(OP_STAGE_KEYS), revenue: pick(REVENUE_KEYS) });
    }
  }
  return out;
}

// Investors per industry set, kept for five minutes so consecutive batches of a run
// don't re-read the same slice of the investor index.
const scorableCache = new Map<string, { at: number; rows: Scorable[] }>();
async function scorablesFor(key: string, industries: string[]): Promise<Scorable[]> {
  const hit = scorableCache.get(key);
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.rows;
  const got = await scorablesForIndustries(industries);
  if (got === null) throw new Error("The investor match index is unavailable. Rebuild it from Admin, Fit, then run matching again.");
  if (scorableCache.size > 500) scorableCache.clear();
  scorableCache.set(key, { at: Date.now(), rows: got });
  return got;
}

/** Match the next batch of ready founders. Call repeatedly until `remaining` is 0. */
export async function runMatchingBatch(campaignId: string, limit = 60): Promise<{ processed: number; remaining: number }> {
  const campaign = await getMatchCampaign(campaignId);
  if (!campaign) throw new Error("Match campaign not found");
  const cfg = campaign.config;

  const { data: pending } = await db()
    .from("match_campaign_founders")
    .select("id, founder_contact_id")
    .eq("campaign_id", campaignId)
    .is("excluded_reason", null)
    .eq("top_matches", "[]")
    .limit(limit);
  const batch = (pending ?? []) as Array<{ id: string; founder_contact_id: string }>;
  if (batch.length === 0) return { processed: 0, remaining: 0 };

  const ids = batch.map((b) => b.founder_contact_id);
  const [fields, extras] = await Promise.all([loadFounderFields(ids), loadExtras(ids)]);
  const matchRows: Row[] = [];
  const founderUpdates: Row[] = [];
  const stamp = new Date().toISOString();

  for (const b of batch) {
    const f = fields.get(b.founder_contact_id);
    const common = { id: b.id, campaign_id: campaignId, founder_contact_id: b.founder_contact_id, updated_at: stamp };
    if (!f) {
      founderUpdates.push({ ...common, excluded_reason: "missing_industry", send_status: "skipped" });
      continue;
    }
    const answers = founderToFitAnswers(f, extras.get(f.id) ?? { operatingStages: [], revenue: [] });
    const key = [...answers.industry].sort().join("|");
    const scorables = await scorablesFor(key, answers.industry);
    const byId = new Map(scorables.map((s) => [s.id, s]));
    const ranked = rankScorables(scorables, answers);
    const kept = ranked.slice(0, cfg.top_n);
    for (const m of kept) {
      matchRows.push({
        campaign_founder_id: b.id,
        investor_contact_id: m.contactId,
        match_score: Math.round(m.fit),
        investor_type: m.types[0] ?? null,
        sectors: m.sectors.slice(0, 8),
        stages: byId.get(m.contactId)?.fields.stages ?? [],
        check_band: m.checkSize,
        reasons: m.summary ? [m.summary] : [],
      });
    }
    const top: TopMatch[] = kept.slice(0, cfg.preview_count).map((m) => ({
      investor_type: m.types[0] ?? null,
      sectors: m.sectors.slice(0, 3),
      stages: byId.get(m.contactId)?.fields.stages ?? [],
      check_band: m.checkSize,
      fit: Math.round(m.fit),
    }));
    founderUpdates.push(
      ranked.length === 0
        ? { ...common, match_count: 0, excluded_reason: "no_matches", send_status: "skipped", top_matches: [] }
        : { ...common, match_count: ranked.length, top_matches: top },
    );
  }

  // Writes are batched: one delete, chunked inserts, one upsert of the founder rows.
  await db().from("match_campaign_matches").delete().in("campaign_founder_id", batch.map((b) => b.id));
  for (const part of chunk(matchRows, 1000)) {
    const { error } = await db().from("match_campaign_matches").insert(part);
    if (error) throw new Error(error.message);
  }
  // Rows differ in shape (matched vs no matches), so group them by their keys for upsert.
  const groups = new Map<string, Row[]>();
  for (const u of founderUpdates) {
    const k = Object.keys(u).sort().join(",");
    groups.set(k, [...(groups.get(k) ?? []), u]);
  }
  for (const rows of groups.values()) {
    const { error } = await db().from("match_campaign_founders").upsert(rows, { onConflict: "id" });
    if (error) throw new Error(error.message);
  }

  const { count } = await db()
    .from("match_campaign_founders")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .is("excluded_reason", null)
    .eq("top_matches", "[]");
  return { processed: batch.length, remaining: count ?? 0 };
}

/** Admin removes (or restores) one investor from a founder's matches. The count and
 *  the top preview recompute from what is left. */
export async function setMatchRemoved(matchId: string, removed: boolean, adminId: string | null): Promise<void> {
  const { data: m } = await db().from("match_campaign_matches").select("id, campaign_founder_id, removed").eq("id", matchId).maybeSingle();
  if (!m) throw new Error("Match not found");
  const row = m as { id: string; campaign_founder_id: string; removed: boolean };
  if (row.removed === removed) return;
  await db().from("match_campaign_matches").update({ removed, removed_by: removed ? adminId : null, removed_at: removed ? new Date().toISOString() : null }).eq("id", matchId);

  const { data: founder } = await db().from("match_campaign_founders").select("id, campaign_id, match_count, send_status").eq("id", row.campaign_founder_id).single();
  const fr = founder as { id: string; campaign_id: string; match_count: number; send_status: string };
  const campaign = await getMatchCampaign(fr.campaign_id);
  const preview = campaign?.config.preview_count ?? 3;
  const { data: left } = await db()
    .from("match_campaign_matches")
    .select("investor_type, sectors, stages, check_band, match_score")
    .eq("campaign_founder_id", fr.id)
    .eq("removed", false)
    .order("match_score", { ascending: false })
    .limit(preview);
  const top: TopMatch[] = ((left ?? []) as Array<{ investor_type: string | null; sectors: string[]; stages: string[]; check_band: string | null; match_score: number }>).map((x) => ({
    investor_type: x.investor_type, sectors: (x.sectors ?? []).slice(0, 3), stages: x.stages ?? [], check_band: x.check_band, fit: x.match_score,
  }));
  const count = Math.max(0, fr.match_count + (removed ? -1 : 1));
  await db()
    .from("match_campaign_founders")
    .update(
      count === 0
        ? { match_count: 0, top_matches: top, excluded_reason: "no_matches", send_status: fr.send_status === "sent" ? "sent" : "skipped" }
        : { match_count: count, top_matches: top, ...(fr.send_status === "skipped" ? { excluded_reason: null, send_status: "pending" } : {}) },
    )
    .eq("id", fr.id);
}

// ── Listing for steps 3, 4 and 6 ───────────────────────────────────────────────

export type CampaignFounderRow = {
  id: string;
  founder_contact_id: string;
  company: string | null;
  email: string | null;
  industry: string | null;
  funding_stage: string | null;
  founder_type: string | null;
  match_count: number;
  top_matches: TopMatch[];
  excluded_reason: ExcludedReason | null;
  send_status: string;
  sent_at: string | null;
  opened_page_at: string | null;
  clicked_call_at: string | null;
  clicked_intro_at: string | null;
  email_status: string | null;
  industry_tag: ReturnType<typeof sourceTag>;
  stage_tag: ReturnType<typeof sourceTag>;
};

export async function listCampaignFounders(
  campaignId: string,
  opts: { view?: "all" | "ready" | "matched" | "excluded"; q?: string; page?: number; pageSize?: number } = {},
): Promise<{ rows: CampaignFounderRow[]; total: number }> {
  const page = opts.page ?? 0;
  const pageSize = opts.pageSize ?? 50;
  let q = db().from("match_campaign_founders").select("*", { count: "exact" }).eq("campaign_id", campaignId);
  if (opts.view === "ready") q = q.is("excluded_reason", null);
  if (opts.view === "matched") q = q.is("excluded_reason", null).gt("match_count", 0);
  if (opts.view === "excluded") q = q.not("excluded_reason", "is", null);
  const term = (opts.q ?? "").trim().replace(/[%,()]/g, " ").trim();
  if (term) q = q.or(`company.ilike.%${term}%,email.ilike.%${term}%,industry.ilike.%${term}%,funding_stage.ilike.%${term}%`);
  const order = opts.view === "matched" ? "match_count" : "company";
  const { data, count, error } = await q.order(order, { ascending: order === "company", nullsFirst: false }).range(page * pageSize, page * pageSize + pageSize - 1);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Row[];
  const fields = await loadFounderFields(rows.map((r) => String(r.founder_contact_id)));
  return {
    total: count ?? 0,
    rows: rows.map((r) => {
      const f = fields.get(String(r.founder_contact_id));
      return {
        id: String(r.id),
        founder_contact_id: String(r.founder_contact_id),
        company: (r.company as string) ?? null,
        email: (r.email as string) ?? null,
        industry: (r.industry as string) ?? null,
        funding_stage: (r.funding_stage as string) ?? null,
        founder_type: (r.founder_type as string) ?? null,
        match_count: Number(r.match_count ?? 0),
        top_matches: (r.top_matches as TopMatch[]) ?? [],
        excluded_reason: (r.excluded_reason as ExcludedReason) ?? null,
        send_status: String(r.send_status ?? "pending"),
        sent_at: (r.sent_at as string) ?? null,
        opened_page_at: (r.opened_page_at as string) ?? null,
        clicked_call_at: (r.clicked_call_at as string) ?? null,
        clicked_intro_at: (r.clicked_intro_at as string) ?? null,
        email_status: f?.email_status ?? null,
        industry_tag: sourceTag(f?.industry_source),
        stage_tag: sourceTag(f?.stage_source),
      };
    }),
  };
}

export type AdminMatchRow = {
  id: string;
  investor_contact_id: string;
  investor_name: string | null;
  investor_company: string | null;
  investor_type: string | null;
  sectors: string[];
  stages: string[];
  check_band: string | null;
  match_score: number;
  removed: boolean;
};

export async function listFounderMatches(campaignFounderId: string): Promise<AdminMatchRow[]> {
  const { data, error } = await db()
    .from("match_campaign_matches")
    .select("id, investor_contact_id, investor_type, sectors, stages, check_band, match_score, removed, investor:crm_contacts!match_campaign_matches_investor_contact_id_fkey(name, company)")
    .eq("campaign_founder_id", campaignFounderId)
    .order("match_score", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<Row & { investor: { name: string | null; company: string | null } | null }>).map((r) => ({
    id: String(r.id),
    investor_contact_id: String(r.investor_contact_id),
    investor_name: r.investor?.name ?? null,
    investor_company: r.investor?.company ?? null,
    investor_type: (r.investor_type as string) ?? null,
    sectors: (r.sectors as string[]) ?? [],
    stages: (r.stages as string[]) ?? [],
    check_band: (r.check_band as string) ?? null,
    match_score: Number(r.match_score ?? 0),
    removed: Boolean(r.removed),
  }));
}

export type CampaignCounts = {
  selected: number;
  ready: number;
  matchedPending: number;
  withMatches: number;
  noMatches: number;
  excluded: number;
  sent: number;
  dryRun: number;
  failed: number;
  toSend: number;
};

export async function campaignCounts(campaignId: string): Promise<CampaignCounts> {
  const count = async (build: (q: Db) => Db): Promise<number> => {
    const { count: c } = await build(db().from("match_campaign_founders").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId));
    return c ?? 0;
  };
  const [selected, ready, matchedPending, withMatches, noMatches, excluded, sent, dryRun, failed, toSend] = await Promise.all([
    count((q) => q),
    count((q) => q.or("excluded_reason.is.null,excluded_reason.eq.no_matches")),
    count((q) => q.is("excluded_reason", null).eq("top_matches", "[]")),
    count((q) => q.is("excluded_reason", null).gt("match_count", 0)),
    count((q) => q.eq("excluded_reason", "no_matches")),
    count((q) => q.not("excluded_reason", "is", null).neq("excluded_reason", "no_matches")),
    count((q) => q.eq("send_status", "sent")),
    count((q) => q.eq("send_status", "dry_run")),
    count((q) => q.eq("send_status", "failed")),
    count((q) => q.is("excluded_reason", null).gt("match_count", 0).eq("send_status", "pending")),
  ]);
  return { selected, ready, matchedPending, withMatches, noMatches, excluded, sent, dryRun, failed, toSend };
}

// ── Step 5 and 6: email ────────────────────────────────────────────────────────

let networkCache: { at: number; total: number } | null = null;
export async function networkTotal(): Promise<number> {
  if (networkCache && Date.now() - networkCache.at < 10 * 60 * 1000) return networkCache.total;
  const { count } = await db().from("crm_contacts").select("id", { count: "exact", head: true }).or("contact_type.eq.investor,module.eq.investor");
  networkCache = { at: Date.now(), total: count ?? 0 };
  return networkCache.total;
}

type FounderSendRow = { id: string; founder_contact_id: string; email: string | null; company: string | null; industry: string | null; funding_stage: string | null; match_count: number; top_matches: TopMatch[]; founder_profile_id: string | null };

export async function renderForFounder(campaign: MatchCampaign, row: FounderSendRow, firstName: string | null) {
  const token = makeMatchToken(row.id);
  return renderMatchEmail({
    firstName,
    company: row.company || "your company",
    industry: row.industry,
    stage: row.funding_stage,
    matchCount: row.match_count,
    networkLabel: networkLabel(await networkTotal()),
    top: row.top_matches ?? [],
    subjectTemplate: campaign.config.subject,
    pageUrl: absoluteUrl(`/matches/${token}`),
    callUrl: absoluteUrl(`/mc/${token}?a=call`),
    introUrl: absoluteUrl(`/mc/${token}?a=intro`),
  });
}

async function firstNameFor(contactId: string): Promise<string | null> {
  const { data } = await db().from("crm_contacts").select("name").eq("id", contactId).maybeSingle();
  const n = String((data as { name?: string | null } | null)?.name ?? "").trim();
  return n ? n.split(/\s+/)[0]! : null;
}

export async function previewForFounder(campaignId: string, campaignFounderId?: string | null) {
  const campaign = await getMatchCampaign(campaignId);
  if (!campaign) throw new Error("Match campaign not found");
  let q = db().from("match_campaign_founders").select("id, founder_contact_id, email, company, industry, funding_stage, match_count, top_matches, founder_profile_id").eq("campaign_id", campaignId);
  q = campaignFounderId ? q.eq("id", campaignFounderId) : q.is("excluded_reason", null).gt("match_count", 0).order("match_count", { ascending: false }).limit(1);
  const { data } = await q.maybeSingle();
  if (!data) return null;
  const row = data as FounderSendRow;
  const rendered = await renderForFounder(campaign, row, await firstNameFor(row.founder_contact_id));
  return { founderId: row.id, company: row.company, token: makeMatchToken(row.id), ...rendered };
}

export async function sendMatchTest(campaignId: string, to: string, campaignFounderId?: string | null) {
  const email = firstEmail(to);
  if (!email) return { ok: false, error: "A valid email is required." };
  if (!emailConfigured()) return { ok: false, error: "Email provider not configured. Set RESEND_API_KEY before sending." };
  const campaign = await getMatchCampaign(campaignId);
  if (!campaign) return { ok: false, error: "Match campaign not found" };
  const preview = await previewForFounder(campaignId, campaignFounderId);
  if (!preview) return { ok: false, error: "No founder with matches yet. Run matching first." };
  const result = await sendMarketingEmail({
    to: email,
    from_name: campaign.from_name,
    from_email: campaign.from_email,
    reply_to: campaign.reply_to,
    subject: `[TEST] ${preview.subject}`,
    html_body: preview.html,
    text_body: preview.text,
    unsubscribe_token: makeUnsubscribeToken(email),
  });
  return { ok: result.ok, error: result.error };
}

/** Schedule (or start now). Sending then runs from the Scheduled campaigns job. */
export async function scheduleMatchCampaign(campaignId: string, at: string | null): Promise<MatchCampaign> {
  const campaign = await getMatchCampaign(campaignId);
  if (!campaign) throw new Error("Match campaign not found");
  const counts = await campaignCounts(campaignId);
  if (counts.matchedPending > 0) throw new Error("Matching has not finished. Run matching for every ready founder first.");
  if (counts.toSend === 0) throw new Error("No founders with matches are waiting to be emailed.");
  const when = at ? new Date(at) : new Date();
  if (Number.isNaN(when.getTime())) throw new Error("Invalid date.");
  const { data, error } = await db()
    .from("marketing_campaigns")
    .update({ status: "scheduled", scheduled_at: when.toISOString(), updated_at: new Date().toISOString() })
    .eq("id", campaignId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return toCampaign(data as Row);
}

export async function setMatchCampaignStatus(campaignId: string, status: "paused" | "cancelled" | "draft"): Promise<void> {
  await db().from("marketing_campaigns").update({ status, updated_at: new Date().toISOString() }).eq("id", campaignId);
}

function startOfTodayUtc(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Send the next batch: pending founders with matches, within the daily cap. Called by
 * the Scheduled campaigns job through sendCampaign(). Leaves the campaign `scheduled`
 * until every founder is handled, then marks it `sent`.
 */
export async function sendMatchCampaignBatch(campaignId: string, maxPerRun = 100): Promise<{ sent: number; skipped: number; failed: number }> {
  const campaign = await getMatchCampaign(campaignId);
  if (!campaign) throw new Error("Match campaign not found");
  if (campaign.status !== "scheduled") throw new Error(`Match campaign is ${campaign.status}; schedule it to send.`);
  if (campaign.scheduled_at && new Date(campaign.scheduled_at).getTime() > Date.now()) return { sent: 0, skipped: 0, failed: 0 };
  const dry = campaign.config.dry_run;
  if (!dry && !marketingSendEnabled()) throw new Error("Marketing sending is disabled (MARKETING_SEND_LIVE=false). No email was sent.");
  if (!dry && !emailConfigured()) throw new Error("Email provider not configured. Set RESEND_API_KEY before sending.");

  const { count: sentToday } = await db()
    .from("match_campaign_founders")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .in("send_status", ["sent", "dry_run"])
    .gte("sent_at", startOfTodayUtc());
  const budget = Math.max(0, Math.min(maxPerRun, campaign.config.daily_cap - (sentToday ?? 0)));
  if (budget === 0) return { sent: 0, skipped: 0, failed: 0 };

  const { data } = await db()
    .from("match_campaign_founders")
    .select("id, founder_contact_id, email, company, industry, funding_stage, match_count, top_matches, founder_profile_id")
    .eq("campaign_id", campaignId)
    .is("excluded_reason", null)
    .gt("match_count", 0)
    .eq("send_status", "pending")
    .order("match_count", { ascending: false })
    .limit(budget);
  const rows = (data ?? []) as FounderSendRow[];

  let sent = 0, skipped = 0, failed = 0;
  const now = () => new Date().toISOString();
  for (const row of rows) {
    const email = firstEmail(row.email);
    if (!email) {
      await db().from("match_campaign_founders").update({ send_status: "skipped", excluded_reason: "invalid_email", updated_at: now() }).eq("id", row.id);
      skipped++;
      continue;
    }
    // Suppression is re-checked at send time: someone may have unsubscribed since the check.
    const unsub = await unsubscribedSet([email]);
    if (unsub.size) {
      await db().from("match_campaign_founders").update({ send_status: "skipped", excluded_reason: "suppressed", updated_at: now() }).eq("id", row.id);
      skipped++;
      continue;
    }
    // Demo and internal founder accounts never receive real email.
    if (row.founder_profile_id && !(await emailDispatchAllowedForUser(db(), row.founder_profile_id))) {
      await db().from("match_campaign_founders").update({ send_status: "skipped", send_error: "Demo or internal account", updated_at: now() }).eq("id", row.id);
      skipped++;
      continue;
    }
    const rendered = await renderForFounder(campaign, row, await firstNameFor(row.founder_contact_id));
    if (dry) {
      await db().from("match_campaign_founders").update({ send_status: "dry_run", sent_at: now(), updated_at: now() }).eq("id", row.id);
      sent++;
      continue;
    }
    const result = await sendMarketingEmail({
      to: email,
      company: row.company,
      from_name: campaign.from_name,
      from_email: campaign.from_email,
      reply_to: campaign.reply_to,
      subject: rendered.subject,
      html_body: rendered.html,
      text_body: rendered.text,
      unsubscribe_token: makeUnsubscribeToken(email),
    });
    // A marketing contact lets the existing open and click webhook credit this campaign.
    const { data: mc } = await db()
      .from("marketing_contacts")
      .upsert({ email, company: row.company, crm_contact_id: row.founder_contact_id, source: "match_campaign", updated_at: now() }, { onConflict: "email" })
      .select("id")
      .single();
    const contactId = (mc as { id: string } | null)?.id;
    if (contactId) {
      await db().from("marketing_events").insert({
        campaign_id: campaignId, contact_id: contactId, email, resend_id: result.resend_id,
        event_type: result.ok ? "sent" : "failed", metadata: result.error ? { error: result.error } : { match_founder_id: row.id },
      });
    }
    await db()
      .from("match_campaign_founders")
      .update(result.ok
        ? { send_status: "sent", sent_at: now(), message_id: result.resend_id, send_error: null, updated_at: now() }
        : { send_status: "failed", send_error: result.error ?? "Send failed", updated_at: now() })
      .eq("id", row.id);
    if (result.ok) sent++; else failed++;
    await new Promise((r) => setTimeout(r, 200));
  }

  const counts = await campaignCounts(campaignId);
  const update: Row = { stat_sent: counts.sent, updated_at: now() };
  if (counts.toSend === 0) {
    update.status = counts.sent === 0 && counts.failed > 0 ? "paused" : "sent";
    update.sent_at = now();
  }
  await db().from("marketing_campaigns").update(update).eq("id", campaignId);
  return { sent, skipped, failed };
}
