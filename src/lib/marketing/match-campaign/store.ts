/**
 * Match campaign server logic: create, founder list, data check, matching,
 * admin removals, and the page / click tracking behind the public token links.
 * Sending lives in send.ts and results in results.ts. Server only.
 */
import { marketingDb } from "@/lib/marketing/db";
import { getInvestorMatchConfig } from "@/lib/settings/platform-settings";
import { checkFounder, canonicalStages, founderCompanyProfile } from "./fields";
import { loadCampaignInvestors } from "./investors";
import { investorIdentity, matchFounder, toMasked } from "./matcher";
import {
  DEFAULT_MATCH_CONFIG,
  readMatchConfig,
  type ExcludedReason,
  type FounderFieldsRow,
  type FounderType,
  type MaskedMatch,
  type MatchConfig,
  type SendStatus,
} from "./types";
import { DEFAULT_SUBJECT } from "./email";

/** Matches stored per founder. The full count is kept in match_count. */
export const STORED_MATCHES_PER_FOUNDER = 50;

const FIELD_COLUMNS =
  "id, name, email, email_status, suppressed, company, country, industries, funding_stages, seeking_amount, seeking_investor_types, supabase_profile_id, pipeline_stage, founder_type, industry_source, stage_source";

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// ── Campaign ────────────────────────────────────────────────────────────────

export type MatchCampaignRow = {
  id: string;
  name: string;
  status: string;
  from_name: string;
  from_email: string;
  reply_to: string | null;
  subject_override: string | null;
  scheduled_at: string | null;
  sent_at: string | null;
  stat_sent: number;
  stat_opened: number;
  stat_clicked: number;
  created_at: string;
  match_config: MatchConfig;
};

export async function createMatchCampaign(
  input: { name: string; from_name: string; from_email: string; reply_to?: string | null; call_url?: string | null },
  createdBy: string | null,
): Promise<MatchCampaignRow> {
  const db = marketingDb();
  const config: MatchConfig = { ...DEFAULT_MATCH_CONFIG, ...(input.call_url?.trim() ? { call_url: input.call_url.trim() } : {}) };
  const { data, error } = await db
    .from("marketing_campaigns")
    .insert({
      name: input.name.trim(),
      from_name: input.from_name.trim(),
      from_email: input.from_email.trim(),
      reply_to: input.reply_to?.trim() || null,
      group_type: "founder",
      status: "draft",
      subject_override: DEFAULT_SUBJECT,
      match_config: config,
      ...(createdBy ? { created_by: createdBy } : {}),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { ...(data as MatchCampaignRow), match_config: readMatchConfig((data as { match_config: unknown }).match_config) };
}

export async function getMatchCampaign(id: string): Promise<MatchCampaignRow | null> {
  const db = marketingDb();
  const { data } = await db
    .from("marketing_campaigns")
    .select("id, name, status, from_name, from_email, reply_to, subject_override, scheduled_at, sent_at, stat_sent, stat_opened, stat_clicked, created_at, match_config")
    .eq("id", id)
    .maybeSingle();
  if (!data || !(data as { match_config: unknown }).match_config) return null;
  return { ...(data as MatchCampaignRow), match_config: readMatchConfig((data as { match_config: unknown }).match_config) };
}

/** Editable while the campaign has not started sending. */
export async function updateMatchCampaign(
  id: string,
  patch: {
    name?: string;
    from_name?: string;
    from_email?: string;
    reply_to?: string | null;
    subject_override?: string;
    config?: Partial<MatchConfig>;
  },
): Promise<void> {
  const db = marketingDb();
  const current = await getMatchCampaign(id);
  if (!current) throw new Error("Match campaign not found");
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.from_name !== undefined) update.from_name = patch.from_name;
  if (patch.from_email !== undefined) update.from_email = patch.from_email;
  if (patch.reply_to !== undefined) update.reply_to = patch.reply_to;
  if (patch.subject_override !== undefined) update.subject_override = patch.subject_override;
  if (patch.config) update.match_config = readMatchConfig({ ...current.match_config, ...patch.config });
  const { error } = await db.from("marketing_campaigns").update(update).eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Founder list ────────────────────────────────────────────────────────────

export type FounderFilter = {
  listId?: string | null;
  founderTypes?: FounderType[] | null;
  industries?: string[] | null;
  stages?: string[] | null;
  pipelineStages?: string[] | null;
  /** Only founders with both industry and stage filled. */
  filledOnly?: boolean;
  q?: string | null;
  limit?: number;
};

/** crm contact ids behind a saved marketing list (via marketing_contacts.crm_contact_id, then email). */
async function listFounderIds(listId: string): Promise<string[]> {
  const db = marketingDb();
  const contactIds: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await db.from("marketing_list_contacts").select("contact_id").eq("list_id", listId).range(from, from + 999);
    const rows = (data ?? []) as Array<{ contact_id: string }>;
    contactIds.push(...rows.map((r) => r.contact_id));
    if (rows.length < 1000) break;
  }
  const ids = new Set<string>();
  const emails: string[] = [];
  for (const part of chunk(contactIds, 200)) {
    const { data } = await db.from("marketing_contacts").select("email, crm_contact_id").in("id", part);
    for (const r of (data ?? []) as Array<{ email: string; crm_contact_id: string | null }>) {
      if (r.crm_contact_id) ids.add(r.crm_contact_id);
      else if (r.email) emails.push(r.email.trim().toLowerCase());
    }
  }
  for (const part of chunk(emails, 200)) {
    const { data } = await db.from("crm_contacts").select("id").eq("module", "founder").in("email", part);
    for (const r of (data ?? []) as Array<{ id: string }>) ids.add(r.id);
  }
  return [...ids];
}

export async function loadFounderFields(ids: readonly string[]): Promise<FounderFieldsRow[]> {
  const db = marketingDb();
  const out: FounderFieldsRow[] = [];
  for (const part of chunk(ids, 200)) {
    const { data, error } = await db.from("match_campaign_founder_fields").select(FIELD_COLUMNS).in("id", part);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as FounderFieldsRow[]));
  }
  return out;
}

/** One query for the founder list step. Returns the rows shown plus the total that fit the filter. */
export async function searchFounders(f: FounderFilter): Promise<{ rows: FounderFieldsRow[]; total: number }> {
  const db = marketingDb();
  const limit = Math.min(Math.max(f.limit ?? 200, 1), 1000);
  let ids: string[] | null = null;
  if (f.listId) {
    ids = await listFounderIds(f.listId);
    if (ids.length === 0) return { rows: [], total: 0 };
  }
  const build = (subset: string[] | null) => {
    let q = db.from("match_campaign_founder_fields").select(FIELD_COLUMNS, { count: "exact" });
    if (subset) q = q.in("id", subset);
    if (f.founderTypes?.length) q = q.in("founder_type", f.founderTypes);
    if (f.industries?.length) q = q.overlaps("industries", f.industries);
    if (f.stages?.length) q = q.overlaps("funding_stages", f.stages);
    if (f.pipelineStages?.length) q = q.in("pipeline_stage", f.pipelineStages);
    if (f.filledOnly) q = q.neq("industries", "{}").neq("funding_stages", "{}");
    if (f.q?.trim()) {
      const term = f.q.trim().replace(/[%,()]/g, " ");
      q = q.or(`company.ilike.%${term}%,name.ilike.%${term}%,email.ilike.%${term}%`);
    }
    return q.order("company", { ascending: true, nullsFirst: false });
  };
  if (!ids) {
    const { data, count, error } = await build(null).limit(limit);
    if (error) throw new Error(error.message);
    return { rows: (data ?? []) as FounderFieldsRow[], total: count ?? 0 };
  }
  // A saved list: filter it in chunks (the id list can be long), then cap what is shown.
  const rows: FounderFieldsRow[] = [];
  let total = 0;
  for (const part of chunk(ids, 200)) {
    const { data, count, error } = await build(part);
    if (error) throw new Error(error.message);
    total += count ?? 0;
    if (rows.length < limit) rows.push(...((data ?? []) as FounderFieldsRow[]).slice(0, limit - rows.length));
  }
  return { rows, total };
}

/** Distinct values for the filter menus (small: industries and stages people actually picked). */
export async function founderFilterOptions(): Promise<{ industries: string[]; stages: string[]; pipelineStages: string[] }> {
  const db = marketingDb();
  const view = () => db.from("match_campaign_founder_fields");
  const [ind, stg, pipe] = await Promise.all([
    view().select("industries").neq("industries", "{}").limit(5000),
    view().select("funding_stages").neq("funding_stages", "{}").limit(5000),
    view().select("pipeline_stage").not("pipeline_stage", "is", null).limit(5000),
  ]);
  const collect = (rows: unknown, key: string) => {
    const set = new Set<string>();
    for (const r of (rows ?? []) as Array<Record<string, string[] | string | null>>) {
      const v = r[key];
      if (Array.isArray(v)) v.forEach((x) => set.add(x));
      else if (v) set.add(v);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  };
  return {
    industries: collect(ind.data, "industries"),
    stages: collect(stg.data, "funding_stages"),
    pipelineStages: collect(pipe.data, "pipeline_stage"),
  };
}

// ── Data check ──────────────────────────────────────────────────────────────

async function unsubscribedEmails(emails: readonly string[]): Promise<Set<string>> {
  const db = marketingDb();
  const out = new Set<string>();
  const lower = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  for (const part of chunk(lower, 200)) {
    const { data } = await db.from("marketing_unsubscribes").select("email").in("email", part);
    for (const r of (data ?? []) as Array<{ email: string }>) out.add(r.email.trim().toLowerCase());
  }
  return out;
}

export type CheckSummary = { selected: number; ready: number; missingData: number; emailIssue: number; suppressed: number; eu: number };

/**
 * Puts the selected founders on the campaign and runs the data check. Founders
 * already emailed stay as they are; founders no longer selected and not yet
 * emailed are removed.
 */
export async function setCampaignFounders(campaignId: string, founderIds: readonly string[]): Promise<CheckSummary> {
  const db = marketingDb();
  const campaign = await getMatchCampaign(campaignId);
  if (!campaign) throw new Error("Match campaign not found");
  const cfg = campaign.match_config;
  const unique = [...new Set(founderIds)];
  const rows = await loadFounderFields(unique);
  const unsub = await unsubscribedEmails(rows.map((r) => r.email ?? ""));

  const { data: existing } = await db.from("match_campaign_founders").select("id, founder_contact_id, send_status").eq("campaign_id", campaignId);
  const done = new Set(
    ((existing ?? []) as Array<{ founder_contact_id: string; send_status: SendStatus }>)
      .filter((r) => r.send_status !== "pending")
      .map((r) => r.founder_contact_id),
  );
  const keep = new Set(unique);
  const stale = ((existing ?? []) as Array<{ id: string; founder_contact_id: string; send_status: SendStatus }>)
    .filter((r) => r.send_status === "pending" && !keep.has(r.founder_contact_id))
    .map((r) => r.id);
  for (const part of chunk(stale, 200)) await db.from("match_campaign_founders").delete().in("id", part);

  const summary: CheckSummary = { selected: rows.length, ready: 0, missingData: 0, emailIssue: 0, suppressed: 0, eu: 0 };
  const now = new Date().toISOString();
  const upserts = rows
    .filter((r) => !done.has(r.id))
    .map((r) => {
      const reason = checkFounder(r, {
        verifiedOnly: cfg.verified_only,
        excludeEu: cfg.exclude_eu,
        includeInferred: cfg.include_inferred,
        unsubscribed: Boolean(r.email && unsub.has(r.email.trim().toLowerCase())),
      });
      tally(summary, reason);
      return {
        campaign_id: campaignId,
        founder_contact_id: r.id,
        email: r.email,
        company: r.company ?? r.name,
        industry: (r.industries ?? []).join(", ") || null,
        funding_stage: canonicalStages(r.funding_stages).join(", ") || null,
        founder_type: r.founder_type,
        excluded_reason: reason,
        updated_at: now,
      };
    });
  for (const part of chunk(upserts, 500)) {
    const { error } = await db.from("match_campaign_founders").upsert(part, { onConflict: "campaign_id,founder_contact_id" });
    if (error) throw new Error(error.message);
  }
  return summary;
}

function tally(s: CheckSummary, reason: ExcludedReason | null) {
  if (!reason) s.ready++;
  else if (reason === "missing_industry" || reason === "missing_stage" || reason === "unconfirmed_data") s.missingData++;
  else if (reason === "suppressed") s.suppressed++;
  else if (reason === "eu_excluded") s.eu++;
  else s.emailIssue++;
}

export type CampaignFounderRow = {
  id: string;
  founder_contact_id: string;
  email: string | null;
  company: string | null;
  industry: string | null;
  funding_stage: string | null;
  founder_type: FounderType | null;
  match_count: number;
  top_matches: MaskedMatch[];
  excluded_reason: ExcludedReason | null;
  send_status: SendStatus;
  sent_at: string | null;
  opened_page_at: string | null;
  clicked_call_at: string | null;
  clicked_intro_at: string | null;
  plan_started_at: string | null;
  founder_profile_id: string | null;
  send_error: string | null;
};

export async function listCampaignFounders(campaignId: string): Promise<CampaignFounderRow[]> {
  const db = marketingDb();
  const out: CampaignFounderRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("match_campaign_founders")
      .select("id, founder_contact_id, email, company, industry, funding_stage, founder_type, match_count, top_matches, excluded_reason, send_status, sent_at, opened_page_at, clicked_call_at, clicked_intro_at, plan_started_at, founder_profile_id, send_error")
      .eq("campaign_id", campaignId)
      .order("company", { ascending: true, nullsFirst: false })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as CampaignFounderRow[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

// ── Matching ────────────────────────────────────────────────────────────────

export type RunSummary = { ready: number; withMatches: number; noMatches: number; investors: number };

/**
 * Matches every ready founder (data check passed, not yet emailed). Investors
 * are loaded once for the whole run. Rerunning replaces earlier matches,
 * including admin removals, so admins review after the last run.
 */
type Db = ReturnType<typeof marketingDb>;

/** Name and firm for each investor contact id, as a founder sees them. Batched. */
async function investorNames(db: Db, ids: readonly string[]): Promise<Map<string, { investor_name: string | null; investor_firm: string | null }>> {
  const out = new Map<string, { investor_name: string | null; investor_firm: string | null }>();
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += 200) {
    const { data, error } = await db.from("crm_contacts").select("id, name, company").in("id", unique.slice(i, i + 200));
    if (error) throw new Error(error.message);
    for (const r of (data ?? []) as Array<{ id: string; name: string | null; company: string | null }>) out.set(r.id, investorIdentity(r.name, r.company));
  }
  return out;
}

/** Stored match rows (with investor_contact_id) to the founder facing snapshot, names attached. */
async function namedSnapshot(db: Db, rows: ReadonlyArray<MaskedMatch & { investor_contact_id: string }>): Promise<MaskedMatch[]> {
  const names = await investorNames(db, rows.map((r) => r.investor_contact_id));
  return rows.map((r) => toMasked({ ...r, ...(names.get(r.investor_contact_id) ?? { investor_name: null, investor_firm: null }) }));
}

export async function runCampaignMatching(campaignId: string): Promise<RunSummary> {
  const db = marketingDb();
  const campaign = await getMatchCampaign(campaignId);
  if (!campaign) throw new Error("Match campaign not found");

  const { data: frows, error } = await db
    .from("match_campaign_founders")
    .select("id, founder_contact_id, excluded_reason")
    .eq("campaign_id", campaignId)
    .eq("send_status", "pending")
    .or("excluded_reason.is.null,excluded_reason.eq.no_matches");
  if (error) throw new Error(error.message);
  const founders = (frows ?? []) as Array<{ id: string; founder_contact_id: string }>;
  const [fields, investors, matchCfg] = await Promise.all([
    loadFounderFields(founders.map((f) => f.founder_contact_id)),
    loadCampaignInvestors(),
    getInvestorMatchConfig(),
  ]);
  const byContact = new Map(fields.map((r) => [r.id, r]));
  const weights = matchCfg.engineWeights;
  const preview = campaign.match_config.preview_count;
  const summary: RunSummary = { ready: founders.length, withMatches: 0, noMatches: 0, investors: investors.length };

  for (const f of founders) {
    const row = byContact.get(f.founder_contact_id);
    if (!row) continue;
    const matches = matchFounder(founderCompanyProfile(row), investors, weights, campaign.match_config.min_score);
    await db.from("match_campaign_matches").delete().eq("campaign_founder_id", f.id);
    const stored = matches.slice(0, STORED_MATCHES_PER_FOUNDER);
    if (stored.length) {
      const { error: insErr } = await db.from("match_campaign_matches").insert(
        stored.map((m) => ({
          campaign_founder_id: f.id,
          investor_contact_id: m.investor_contact_id,
          match_score: m.match_score,
          investor_type: m.investor_type,
          sectors: m.sectors,
          stages: m.stages,
          check_band: m.check_band,
          reasons: m.reasons,
        })),
      );
      if (insErr) throw new Error(insErr.message);
    }
    if (matches.length) summary.withMatches++;
    else summary.noMatches++;
    await db
      .from("match_campaign_founders")
      .update({
        match_count: matches.length,
        top_matches: await namedSnapshot(db, stored.slice(0, preview)),
        excluded_reason: matches.length ? null : "no_matches",
        updated_at: new Date().toISOString(),
      })
      .eq("id", f.id);
  }

  await db
    .from("marketing_campaigns")
    .update({ match_config: { ...campaign.match_config, weights }, updated_at: new Date().toISOString() })
    .eq("id", campaignId);
  return summary;
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
};

/** Admin view of one founder's stored matches, with investor names. */
export async function listFounderMatches(campaignFounderId: string): Promise<AdminMatchRow[]> {
  const db = marketingDb();
  const { data, error } = await db
    .from("match_campaign_matches")
    .select("id, investor_contact_id, investor_type, sectors, stages, check_band, match_score")
    .eq("campaign_founder_id", campaignFounderId)
    .eq("removed", false)
    .order("match_score", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<Omit<AdminMatchRow, "investor_name" | "investor_company">>;
  const names = new Map<string, { name: string | null; company: string | null }>();
  if (rows.length) {
    const { data: inv } = await db.from("crm_contacts").select("id, name, company").in("id", rows.map((r) => r.investor_contact_id));
    for (const r of (inv ?? []) as Array<{ id: string; name: string | null; company: string | null }>) names.set(r.id, { name: r.name, company: r.company });
  }
  return rows.map((r) => ({ ...r, investor_name: names.get(r.investor_contact_id)?.name ?? null, investor_company: names.get(r.investor_contact_id)?.company ?? null }));
}

/** Admin removes an investor from a founder's matches; count and top 3 recompute. */
export async function removeFounderMatch(matchId: string, adminId: string | null): Promise<{ match_count: number }> {
  const db = marketingDb();
  const { data: m } = await db.from("match_campaign_matches").select("id, campaign_founder_id, removed").eq("id", matchId).maybeSingle();
  if (!m) throw new Error("Match not found");
  const row = m as { id: string; campaign_founder_id: string; removed: boolean };
  const { data: f } = await db
    .from("match_campaign_founders")
    .select("id, campaign_id, match_count, send_status")
    .eq("id", row.campaign_founder_id)
    .maybeSingle();
  const founder = f as { id: string; campaign_id: string; match_count: number; send_status: SendStatus } | null;
  if (!founder) throw new Error("Founder not found");
  if (founder.send_status !== "pending") throw new Error("This founder has already been emailed.");
  if (row.removed) return { match_count: founder.match_count };

  await db.from("match_campaign_matches").update({ removed: true, removed_by: adminId, removed_at: new Date().toISOString() }).eq("id", matchId);
  const campaign = await getMatchCampaign(founder.campaign_id);
  const preview = campaign?.match_config.preview_count ?? DEFAULT_MATCH_CONFIG.preview_count;
  const { data: remaining } = await db
    .from("match_campaign_matches")
    .select("investor_contact_id, investor_type, sectors, stages, check_band, match_score")
    .eq("campaign_founder_id", founder.id)
    .eq("removed", false)
    .order("match_score", { ascending: false })
    .limit(preview);
  const count = Math.max(0, founder.match_count - 1);
  await db
    .from("match_campaign_founders")
    .update({
      match_count: count,
      top_matches: await namedSnapshot(db, (remaining ?? []) as Array<MaskedMatch & { investor_contact_id: string }>),
      excluded_reason: count > 0 ? null : "no_matches",
      updated_at: new Date().toISOString(),
    })
    .eq("id", founder.id);
  return { match_count: count };
}

// ── Public token pages ──────────────────────────────────────────────────────

export type FounderPageData = {
  campaignFounderId: string;
  company: string;
  industry: string | null;
  stages: string[];
  matchCount: number;
  matches: MaskedMatch[];
  founderContactId: string;
  email: string | null;
  callUrl: string;
};

/** Everything the public match page shows: investor name and firm, never contact details. */
export async function loadFounderPage(campaignFounderId: string, opts: { track?: boolean } = {}): Promise<FounderPageData | null> {
  const db = marketingDb();
  const { data: f } = await db
    .from("match_campaign_founders")
    .select("id, campaign_id, founder_contact_id, email, company, industry, funding_stage, match_count, opened_page_at")
    .eq("id", campaignFounderId)
    .maybeSingle();
  if (!f) return null;
  const row = f as { id: string; campaign_id: string; founder_contact_id: string; email: string | null; company: string | null; industry: string | null; funding_stage: string | null; match_count: number; opened_page_at: string | null };
  const [campaign, { data: m }] = await Promise.all([
    getMatchCampaign(row.campaign_id),
    db
      .from("match_campaign_matches")
      .select("investor_contact_id, investor_type, sectors, stages, check_band, match_score")
      .eq("campaign_founder_id", row.id)
      .eq("removed", false)
      .order("match_score", { ascending: false }),
  ]);
  if (opts.track !== false && !row.opened_page_at) {
    await db.from("match_campaign_founders").update({ opened_page_at: new Date().toISOString() }).eq("id", row.id);
  }
  return {
    campaignFounderId: row.id,
    company: row.company ?? "Your company",
    industry: row.industry,
    stages: row.funding_stage ? row.funding_stage.split(", ").filter(Boolean) : [],
    matchCount: row.match_count,
    matches: await namedSnapshot(db, (m ?? []) as Array<MaskedMatch & { investor_contact_id: string }>),
    founderContactId: row.founder_contact_id,
    email: row.email,
    callUrl: campaign?.match_config.call_url ?? DEFAULT_MATCH_CONFIG.call_url,
  };
}

/** Records a click once (first click wins) and returns where to send the founder. */
export async function recordFounderClick(campaignFounderId: string, action: "call" | "intro"): Promise<string | null> {
  const db = marketingDb();
  const col = action === "call" ? "clicked_call_at" : "clicked_intro_at";
  const { data } = await db.from("match_campaign_founders").select(`id, campaign_id, ${col}`).eq("id", campaignFounderId).maybeSingle();
  if (!data) return null;
  const row = data as unknown as { id: string; campaign_id: string } & Record<string, string | null>;
  if (!row[col]) await db.from("match_campaign_founders").update({ [col]: new Date().toISOString() }).eq("id", row.id);
  if (action === "intro") return "/start?src=match_campaign";
  const campaign = await getMatchCampaign(row.campaign_id);
  return campaign?.match_config.call_url ?? DEFAULT_MATCH_CONFIG.call_url;
}
