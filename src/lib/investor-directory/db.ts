import "server-only";

/**
 * Investor directory data access. Service role only: every caller is a route
 * or page that has already checked the role (founder or admin). The directory
 * tables have RLS on with no policies, so nothing reaches them from a browser.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { startOfTodayPT, usageFlag, type UsageFlag } from "@/lib/investor-directory/limits";
import type { CleanRow } from "@/lib/investor-directory/clean";
import { loadVocabularies } from "@/lib/vocabulary/store";
import { labelOf } from "@/lib/vocabulary/lists";
import {
  DEFAULT_SETTINGS, DIRECTORY_CONTACT_SOURCE, FREE_TIER,
  type AccessStatus, type DirectoryRecord, type DirectorySettings, type DirectoryTier, type FounderDirectoryAccess,
} from "@/lib/investor-directory/types";

function db(): SupabaseClient {
  return serviceRoleClientUntyped();
}

export const PAGE_SIZE = 80;

// ── Settings and tiers ────────────────────────────────────────────────────

export async function loadSettings(): Promise<DirectorySettings> {
  const { data } = await db().from("investor_directory_settings").select("*").eq("id", 1).maybeSingle();
  return { ...DEFAULT_SETTINGS, ...(data ?? {}) } as DirectorySettings;
}

export async function saveSettings(patch: Partial<DirectorySettings>): Promise<void> {
  const { error } = await db().from("investor_directory_settings").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", 1);
  if (error) throw new Error(error.message);
}

export async function loadTiers(): Promise<DirectoryTier[]> {
  const { data } = await db().from("investor_directory_tiers").select("*").order("sort");
  return (data as DirectoryTier[] | null) ?? [FREE_TIER];
}

export async function saveTier(key: string, patch: Partial<Pick<DirectoryTier, "hold_limit" | "show_email" | "can_export" | "price_cents">>): Promise<void> {
  const { error } = await db().from("investor_directory_tiers").update(patch).eq("key", key);
  if (error) throw new Error(error.message);
}

// ── Founder access ────────────────────────────────────────────────────────

/** Directory ids this company already holds (not archived). */
export async function heldDirectoryIds(companyId: string): Promise<Set<string>> {
  const { data } = await db()
    .from("founder_investor_contacts")
    .select("directory_id")
    .eq("company_id", companyId)
    .not("directory_id", "is", null)
    .neq("status", "archived");
  return new Set(((data ?? []) as { directory_id: string }[]).map((r) => r.directory_id));
}

export async function loadFounderAccess(founderId: string, companyId: string | null): Promise<FounderDirectoryAccess> {
  const [settings, tiers, accessRow, held, today] = await Promise.all([
    loadSettings(),
    loadTiers(),
    db().from("investor_directory_access").select("*").eq("founder_id", founderId).maybeSingle(),
    companyId ? heldDirectoryIds(companyId) : Promise.resolve(new Set<string>()),
    db().from("investor_directory_events").select("count").eq("founder_id", founderId).eq("kind", "import").gte("created_at", startOfTodayPT()),
  ]);
  const row = accessRow.data as { tier: string; status: AccessStatus; status_reason: string | null; terms_version: number | null; terms_accepted_at: string | null } | null;
  const tier = tiers.find((t) => t.key === (row?.tier ?? "free")) ?? FREE_TIER;
  const importedToday = ((today.data ?? []) as { count: number }[]).reduce((s, r) => s + (r.count ?? 0), 0);
  return {
    tier,
    status: row?.status ?? "active",
    statusReason: row?.status_reason ?? null,
    termsAccepted: Boolean(row?.terms_accepted_at) && (row?.terms_version ?? 0) >= settings.terms_version,
    termsAcceptedAt: row?.terms_accepted_at ?? null,
    held: held.size,
    importedToday,
  };
}

export async function acceptTerms(founderId: string, companyId: string | null): Promise<string> {
  const settings = await loadSettings();
  const now = new Date().toISOString();
  const { error } = await db().from("investor_directory_access").upsert(
    { founder_id: founderId, terms_version: settings.terms_version, terms_accepted_at: now, updated_at: now },
    { onConflict: "founder_id" },
  );
  if (error) throw new Error(error.message);
  await logEvent(founderId, companyId, "terms", 0, `Terms v${settings.terms_version}`);
  return now;
}

export async function logEvent(founderId: string, companyId: string | null, kind: string, count: number, detail?: string): Promise<void> {
  await db().from("investor_directory_events").insert({ founder_id: founderId, company_id: companyId, kind, count, detail: detail ?? null });
}

// ── Founder search ────────────────────────────────────────────────────────

export type DirectoryQuery = {
  q?: string;
  types?: string[];
  stages?: string[];
  industries?: string[];
  states?: string[];
  sources?: string[];
  investingNow?: boolean;
  hasEmail?: boolean;
  page?: number;
};

const LIST_COLUMNS =
  "id, firm, contact_name, title, email, phone, website, city, state, investor_types, funding_stages, capital_types, industries, fund_name, fund_size, avg_investment, strategy, investing_now, source, source_url, verified_at, verification";

export type FounderDirectoryRow = Omit<DirectoryRecord, "import_id" | "status" | "opted_out_at" | "in_network" | "notes" | "created_at" | "updated_at" | "country"> & {
  held: boolean;
  hasEmail: boolean;
  hasPhone: boolean;
};

/** Escape a value for a PostgREST ilike pattern inside .or(). */
function likeTerm(q: string): string {
  return `%${q.replace(/[%_,()*\\]/g, " ").trim()}%`;
}

/**
 * Published, non-network rows only. Email and phone are blanked unless the
 * company already holds the contact (they show after import).
 */
export async function searchDirectory(query: DirectoryQuery, companyId: string | null): Promise<{ rows: FounderDirectoryRow[]; total: number; page: number }> {
  const page = Math.max(1, query.page ?? 1);
  let req = db()
    .from("investor_directory")
    .select(LIST_COLUMNS, { count: "exact" })
    .eq("status", "published")
    .eq("in_network", false);
  if (query.q?.trim()) {
    const t = likeTerm(query.q);
    req = req.or(`firm.ilike.${t},contact_name.ilike.${t},city.ilike.${t},state.ilike.${t},fund_name.ilike.${t}`);
  }
  if (query.types?.length) req = req.overlaps("investor_types", query.types);
  if (query.stages?.length) req = req.overlaps("funding_stages", query.stages);
  if (query.industries?.length) req = req.overlaps("industries", query.industries);
  if (query.states?.length) req = req.in("state", query.states);
  if (query.sources?.length) req = req.in("source", query.sources);
  if (query.investingNow) req = req.eq("investing_now", true);
  if (query.hasEmail) req = req.not("email", "is", null);
  const from = (page - 1) * PAGE_SIZE;
  const [{ data, count, error }, held] = await Promise.all([
    req.order("firm").range(from, from + PAGE_SIZE - 1),
    companyId ? heldDirectoryIds(companyId) : Promise.resolve(new Set<string>()),
  ]);
  if (error) throw new Error(error.message);
  const rows = ((data ?? []) as unknown as DirectoryRecord[]).map((r) => {
    const isHeld = held.has(r.id);
    return {
      ...r,
      email: isHeld ? r.email : null,
      phone: isHeld ? r.phone : null,
      held: isHeld,
      hasEmail: Boolean(r.email),
      hasPhone: Boolean(r.phone),
    } as FounderDirectoryRow;
  });
  return { rows, total: count ?? rows.length, page };
}

/** Distinct filter values that exist in the published directory (states, sources). */
export async function directoryFacets(): Promise<{ states: string[]; sources: string[] }> {
  const { data } = await db().from("investor_directory").select("state, source").eq("status", "published").eq("in_network", false).limit(20000);
  const rows = (data ?? []) as { state: string | null; source: string }[];
  return {
    states: [...new Set(rows.map((r) => r.state).filter((s): s is string => Boolean(s)))].sort(),
    sources: [...new Set(rows.map((r) => r.source))].sort(),
  };
}

// ── Founder import ────────────────────────────────────────────────────────

/** Insert directory rows into the founder's address book. Returns how many were added. */
export async function importIntoContacts(input: {
  founderId: string;
  companyId: string;
  ids: string[];
  limit: number;
}): Promise<{ imported: number; alreadyHeld: number; unavailable: number }> {
  const held = await heldDirectoryIds(input.companyId);
  const fresh = [...new Set(input.ids)].filter((id) => !held.has(id));
  const alreadyHeld = input.ids.length - fresh.length;
  if (fresh.length === 0) return { imported: 0, alreadyHeld, unavailable: 0 };

  const { data } = await db()
    .from("investor_directory")
    .select(LIST_COLUMNS)
    .in("id", fresh.slice(0, input.limit))
    .eq("status", "published")
    .eq("in_network", false);
  const rows = (data ?? []) as unknown as DirectoryRecord[];
  const unavailable = Math.min(fresh.length, input.limit) - rows.length;
  if (rows.length === 0) return { imported: 0, alreadyHeld, unavailable };

  const now = new Date().toISOString();
  // Founder contacts store readable labels (the Manual outreach list shows them as text).
  const vocab = await loadVocabularies();
  const labels = (list: keyof typeof vocab, values: string[]) => values.map((v) => labelOf(vocab[list], v)).join(", ") || null;
  const insert = rows.map((r) => ({
    founder_id: input.founderId,
    company_id: input.companyId,
    directory_id: r.id,
    investor_name: r.contact_name ?? r.firm,
    firm_name: r.firm,
    email: r.email,
    phone: r.phone,
    website: r.website,
    investor_type: labels("investor_type", r.investor_types),
    preferred_sectors: labels("industry", r.industries),
    preferred_stages: labels("funding_stage", r.funding_stages),
    check_size_min: r.avg_investment,
    geography: [r.city, r.state].filter(Boolean).join(", ") || null,
    source: DIRECTORY_CONTACT_SOURCE,
    tags: ["investor-directory"],
    notes: `From the iCapOS investor directory (${r.source}). Outside the iCFO network.`,
    status: "new",
    created_at: now,
    updated_at: now,
  }));
  const { error } = await db().from("founder_investor_contacts").insert(insert);
  if (error) throw new Error(error.message);
  await logEvent(input.founderId, input.companyId, "import", insert.length);
  return { imported: insert.length, alreadyHeld, unavailable };
}

/** Held directory contacts for the founder's export. */
export async function heldContactsForExport(companyId: string) {
  const { data } = await db()
    .from("founder_investor_contacts")
    .select("investor_name, firm_name, email, phone, website, investor_type, preferred_stages, preferred_sectors, geography")
    .eq("company_id", companyId)
    .not("directory_id", "is", null)
    .neq("status", "archived")
    .order("firm_name");
  return (data ?? []) as Record<string, string | null>[];
}

/** Bounce pause: run after imports and on the admin Usage page. */
export async function maybeAutoPause(founderId: string, settings: DirectorySettings): Promise<boolean> {
  if (!settings.auto_pause_on_bounce) return false;
  const { sent, bounced } = await sendStats(founderId);
  if (sent < settings.bounce_min_sends) return false;
  if (Math.round((bounced / sent) * 100) <= settings.bounce_pause_pct) return false;
  const { data } = await db().from("investor_directory_access").select("status").eq("founder_id", founderId).maybeSingle();
  if ((data as { status?: string } | null)?.status && (data as { status: string }).status !== "active") return false;
  await setFounderAccess(founderId, { status: "paused", status_reason: `Imports paused automatically: bounce rate above ${settings.bounce_pause_pct}% over ${sent} sends.` }, null);
  return true;
}

// ── Admin: records, imports, verification ─────────────────────────────────

export async function overviewStats(settings: DirectorySettings) {
  const d = db();
  const staleBefore = new Date(Date.now() - settings.stale_days * 86400000).toISOString();
  const head = { count: "exact" as const, head: true };
  const [published, withEmail, unverified, stale, optOut, network, drafts] = await Promise.all([
    d.from("investor_directory").select("id", head).eq("status", "published").eq("in_network", false),
    d.from("investor_directory").select("id", head).eq("status", "published").eq("in_network", false).not("email", "is", null),
    d.from("investor_directory").select("id", head).in("verification", ["unverified", "needs_input", "bounced"]).neq("status", "suppressed"),
    d.from("investor_directory").select("id", head).eq("verification", "verified").lt("verified_at", staleBefore),
    d.from("investor_directory").select("id", head).eq("verification", "opt_out"),
    d.from("investor_directory").select("id", head).eq("in_network", true),
    d.from("investor_directory").select("id", head).eq("status", "draft"),
  ]);
  return {
    published: published.count ?? 0,
    withEmail: withEmail.count ?? 0,
    dueForVerify: (unverified.count ?? 0) + (stale.count ?? 0),
    optOuts: optOut.count ?? 0,
    hiddenAsNetwork: network.count ?? 0,
    drafts: drafts.count ?? 0,
  };
}

export async function networkInvestorCounts(): Promise<{ total: number; withEmail: number }> {
  const d = db();
  const [t, e] = await Promise.all([
    d.from("crm_contacts").select("id", { count: "exact", head: true }).eq("side", "investor"),
    d.from("crm_contacts").select("id", { count: "exact", head: true }).eq("side", "investor").not("email", "is", null),
  ]);
  return { total: t.count ?? 0, withEmail: e.count ?? 0 };
}

export type AdminRecordFilter = {
  q?: string;
  status?: string;
  verification?: string;
  source?: string;
  importId?: string;
  queue?: boolean;
  page?: number;
};

export async function listRecords(f: AdminRecordFilter, settings: DirectorySettings): Promise<{ rows: DirectoryRecord[]; total: number; page: number }> {
  const page = Math.max(1, f.page ?? 1);
  let req = db().from("investor_directory").select("*", { count: "exact" });
  if (f.q?.trim()) {
    const t = likeTerm(f.q);
    req = req.or(`firm.ilike.${t},contact_name.ilike.${t},email.ilike.${t},city.ilike.${t},fund_name.ilike.${t}`);
  }
  if (f.status) req = req.eq("status", f.status);
  if (f.verification) req = req.eq("verification", f.verification);
  if (f.source) req = req.eq("source", f.source);
  if (f.importId) req = req.eq("import_id", f.importId);
  if (f.queue) {
    const staleBefore = new Date(Date.now() - settings.stale_days * 86400000).toISOString();
    req = req.neq("status", "suppressed").or(`verification.in.(unverified,needs_input,bounced),and(verification.eq.verified,verified_at.lt.${staleBefore})`);
  }
  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await req.order(f.queue ? "updated_at" : "firm", { ascending: true }).range(from, from + PAGE_SIZE - 1);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as DirectoryRecord[], total: count ?? 0, page };
}

export async function getRecord(id: string): Promise<DirectoryRecord | null> {
  const { data } = await db().from("investor_directory").select("*").eq("id", id).maybeSingle();
  return (data as DirectoryRecord | null) ?? null;
}

const EDITABLE = [
  "firm", "contact_name", "title", "email", "phone", "website", "city", "state",
  "investor_types", "funding_stages", "capital_types", "industries", "fund_name", "strategy", "investing_now", "notes",
] as const;
export type RecordPatch = Partial<Pick<DirectoryRecord, (typeof EDITABLE)[number]>>;

export async function updateRecord(id: string, patch: RecordPatch, action: "save" | "verify" | "suppress" | "opt_out" | "publish" | "unpublish", adminId: string): Promise<DirectoryRecord> {
  const now = new Date().toISOString();
  const row: Record<string, unknown> = { updated_at: now };
  for (const k of EDITABLE) if (k in patch) row[k] = patch[k];
  if (action === "verify") {
    const industries = (patch.industries ?? (await getRecord(id))?.industries) ?? [];
    if (industries.length === 0) throw new Error("Pick at least one industry before verifying.");
    Object.assign(row, { verification: "verified", verified_at: now, verified_by: adminId });
  }
  if (action === "publish") row.status = "published";
  if (action === "unpublish") row.status = "draft";
  if (action === "suppress") row.status = "suppressed";
  if (action === "opt_out") Object.assign(row, { status: "suppressed", verification: "opt_out", opted_out_at: now });
  const { data, error } = await db().from("investor_directory").update(row).eq("id", id).select("*").single();
  if (error) throw new Error(error.message.includes("investor_directory_email_uq") ? "Another directory record already uses that email." : error.message);
  if (action === "opt_out") {
    // Honor opt-outs everywhere: archive the contact in every founder's list.
    const settings = await loadSettings();
    if (settings.honor_opt_outs) {
      await db().from("founder_investor_contacts").update({ status: "archived", updated_at: now }).eq("directory_id", id);
    }
  }
  if ("email" in patch) await db().rpc("investor_directory_refresh_network");
  return data as DirectoryRecord;
}

/** Mark rows whose email bounced on a founder send. Cheap: the bounce list is small. */
export async function syncBounces(): Promise<number> {
  const { data } = await db()
    .from("email_log")
    .select("to_email")
    .eq("source", "founder_outreach")
    .not("bounced_at", "is", null)
    .limit(5000);
  const emails = [...new Set(((data ?? []) as { to_email: string | null }[]).map((r) => r.to_email?.toLowerCase()).filter((e): e is string => Boolean(e)))];
  if (emails.length === 0) return 0;
  const { data: upd } = await db()
    .from("investor_directory")
    .update({ verification: "bounced", updated_at: new Date().toISOString() })
    .in("email", emails)
    .in("verification", ["unverified", "verified", "needs_input"])
    .select("id");
  return (upd ?? []).length;
}

export type ImportRow = {
  id: string; name: string; source: string; source_url: string | null; file_name: string | null;
  row_count: number; created_count: number; merged_count: number; invalid_email_count: number;
  status: "cleaned" | "verifying" | "published"; created_at: string; published_at: string | null;
};

export async function listImports(): Promise<ImportRow[]> {
  const { data } = await db().from("investor_directory_imports").select("*").order("created_at", { ascending: false }).limit(200);
  return (data ?? []) as ImportRow[];
}

/**
 * Store a cleaned file. New emails become draft records; an email already in
 * the directory is merged (gaps filled, lists unioned) rather than duplicated.
 */
export async function createImport(input: {
  name: string; source: string; sourceUrl: string | null; fileName: string | null;
  rows: CleanRow[]; rowCount: number; mergedInFile: number; invalidEmails: number; adminId: string;
}): Promise<ImportRow> {
  const d = db();
  const { data: imp, error } = await d.from("investor_directory_imports").insert({
    name: input.name, source: input.source, source_url: input.sourceUrl, file_name: input.fileName,
    row_count: input.rowCount, invalid_email_count: input.invalidEmails, status: "verifying", created_by: input.adminId,
  }).select("*").single();
  if (error || !imp) throw new Error(error?.message ?? "Could not create the import.");

  const emails = input.rows.map((r) => r.email).filter((e): e is string => Boolean(e));
  const existing = new Map<string, DirectoryRecord>();
  for (let i = 0; i < emails.length; i += 300) {
    const { data } = await d.from("investor_directory").select("*").in("email", emails.slice(i, i + 300));
    for (const r of (data ?? []) as DirectoryRecord[]) if (r.email) existing.set(r.email.toLowerCase(), r);
  }

  let merged = input.mergedInFile;
  const fresh: Record<string, unknown>[] = [];
  for (const r of input.rows) {
    const prev = r.email ? existing.get(r.email) : undefined;
    if (prev) {
      merged++;
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const [k, v] of Object.entries(r)) {
        const pv = (prev as Record<string, unknown>)[k];
        if (Array.isArray(pv) && Array.isArray(v)) { const u = [...new Set([...pv, ...v])]; if (u.length !== pv.length) patch[k] = u; }
        else if ((pv === null || pv === undefined) && v !== null) patch[k] = v;
      }
      await d.from("investor_directory").update(patch).eq("id", prev.id);
      continue;
    }
    fresh.push({
      ...r,
      source: input.source,
      source_url: input.sourceUrl,
      import_id: (imp as ImportRow).id,
      status: "draft",
      verification: r.industries.length ? "unverified" : "needs_input",
    });
  }
  for (let i = 0; i < fresh.length; i += 500) {
    const { error: e } = await d.from("investor_directory").insert(fresh.slice(i, i + 500));
    if (e) throw new Error(e.message);
  }
  await d.rpc("investor_directory_refresh_network");
  const { data: done } = await d.from("investor_directory_imports")
    .update({ created_count: fresh.length, merged_count: merged })
    .eq("id", (imp as ImportRow).id).select("*").single();
  return done as ImportRow;
}

/** Publish every draft row of an import (opt-outs and suppressed rows stay out). */
export async function publishImport(importId: string): Promise<number> {
  const now = new Date().toISOString();
  const { data } = await db().from("investor_directory").update({ status: "published", updated_at: now })
    .eq("import_id", importId).eq("status", "draft").neq("verification", "opt_out").select("id");
  await db().from("investor_directory_imports").update({ status: "published", published_at: now }).eq("id", importId);
  return (data ?? []).length;
}

// ── Admin: access and usage ───────────────────────────────────────────────

export async function setFounderAccess(
  founderId: string,
  patch: { tier?: string; status?: AccessStatus; status_reason?: string | null },
  adminId: string | null,
): Promise<void> {
  const { error } = await db().from("investor_directory_access").upsert(
    { founder_id: founderId, ...patch, updated_by: adminId, updated_at: new Date().toISOString() },
    { onConflict: "founder_id" },
  );
  if (error) throw new Error(error.message);
  if (patch.status) await logEvent(founderId, null, patch.status === "active" ? "reactivated" : patch.status, 0, patch.status_reason ?? undefined);
  if (patch.tier) await logEvent(founderId, null, "tier_changed", 0, patch.tier);
}

export async function upgradeRequests() {
  const { data } = await db()
    .from("upgrade_requests")
    .select("id, profile_id, requested_plan, status, notes, created_at")
    .eq("request_type", "investor_directory")
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []) as { id: string; profile_id: string; requested_plan: string | null; status: string; notes: string | null; created_at: string }[];
}

export async function requestUpgrade(founderId: string, tierKey: string): Promise<void> {
  const { error } = await db().from("upgrade_requests").insert({
    profile_id: founderId, request_type: "investor_directory", requested_plan: tierKey, status: "pending",
    notes: "Investor directory contact space",
  });
  if (error) throw new Error(error.message);
  await logEvent(founderId, null, "upgrade_requested", 0, tierKey);
}

/** Bounced founder_outreach emails to any of these addresses (email_log is filled by Resend events). */
async function bouncesTo(emails: string[]): Promise<{ to_email: string; bounced_at: string }[]> {
  const list = [...new Set(emails.flatMap((e) => [e, e.toLowerCase()]))];
  const out: { to_email: string; bounced_at: string }[] = [];
  for (let i = 0; i < list.length; i += 300) {
    const { data } = await db()
      .from("email_log")
      .select("to_email, bounced_at")
      .eq("source", "founder_outreach")
      .not("bounced_at", "is", null)
      .in("to_email", list.slice(i, i + 300));
    out.push(...((data ?? []) as { to_email: string; bounced_at: string }[]));
  }
  return out;
}

async function companyIdFor(founderId: string): Promise<string | null> {
  const { data } = await db().from("founder_investor_contacts").select("company_id").eq("founder_id", founderId).limit(1).maybeSingle();
  return (data as { company_id: string } | null)?.company_id ?? null;
}

type RecipientRow = { name: string | null; email: string | null; last_sent_at: string; opened_at: string | null; clicked_at: string | null; replied_at: string | null };

async function recipientsFor(companyId: string | null): Promise<RecipientRow[]> {
  if (!companyId) return [];
  const { data } = await db()
    .from("founder_manual_outreach_recipients")
    .select("name, email, last_sent_at, opened_at, clicked_at, replied_at")
    .eq("company_id", companyId)
    .not("last_sent_at", "is", null)
    .order("last_sent_at", { ascending: false })
    .limit(20000);
  return (data ?? []) as RecipientRow[];
}

/** Sends, replies and bounces on the founder's manual outreach. */
export async function sendStats(founderId: string, companyId?: string | null): Promise<{ sent: number; opened: number; replied: number; bounced: number }> {
  const rows = await recipientsFor(companyId ?? (await companyIdFor(founderId)));
  const bounced = await bouncesTo(rows.map((r) => r.email).filter((e): e is string => Boolean(e)));
  return {
    sent: rows.length,
    opened: rows.filter((r) => r.opened_at).length,
    replied: rows.filter((r) => r.replied_at).length,
    bounced: new Set(bounced.map((b) => b.to_email.toLowerCase())).size,
  };
}

export type UsageRow = {
  founderId: string;
  name: string;
  email: string | null;
  company: string | null;
  tier: string;
  holdLimit: number;
  status: AccessStatus;
  held: number;
  imports30d: number;
  importsInWindow: number;
  sent: number;
  replied: number;
  bounced: number;
  lastActive: string | null;
  termsAcceptedAt: string | null;
  flag: UsageFlag;
};

/** Every founder who has touched the directory (accepted terms, imported, or been given a tier). */
export async function listUsage(settings: DirectorySettings): Promise<UsageRow[]> {
  const d = db();
  const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
  const sinceWindow = new Date(Date.now() - settings.spike_hours * 3600000).toISOString();
  const [{ data: access }, { data: events }, tiers] = await Promise.all([
    d.from("investor_directory_access").select("*"),
    d.from("investor_directory_events").select("founder_id, company_id, kind, count, created_at").gte("created_at", since30).limit(20000),
    loadTiers(),
  ]);
  const ids = new Set<string>([
    ...((access ?? []) as { founder_id: string }[]).map((a) => a.founder_id),
    ...((events ?? []) as { founder_id: string }[]).map((e) => e.founder_id),
  ]);
  if (ids.size === 0) return [];
  const idList = [...ids];
  const [{ data: profiles }, { data: contacts }] = await Promise.all([
    d.from("profiles").select("id, full_name, email").in("id", idList),
    d.from("founder_investor_contacts").select("founder_id, company_id").in("founder_id", idList).not("directory_id", "is", null).neq("status", "archived").limit(50000),
  ]);
  const companyOf = new Map<string, string>();
  const heldOf = new Map<string, number>();
  for (const c of (contacts ?? []) as { founder_id: string; company_id: string }[]) {
    companyOf.set(c.founder_id, c.company_id);
    heldOf.set(c.founder_id, (heldOf.get(c.founder_id) ?? 0) + 1);
  }
  const companyIds = [...new Set(companyOf.values())];
  const { data: companies } = companyIds.length
    ? await d.from("companies").select("id, company_name").in("id", companyIds)
    : { data: [] };
  const companyName = new Map(((companies ?? []) as { id: string; company_name: string }[]).map((c) => [c.id, c.company_name]));

  const out: UsageRow[] = [];
  for (const id of idList) {
    const a = ((access ?? []) as { founder_id: string; tier: string; status: AccessStatus; terms_accepted_at: string | null }[]).find((x) => x.founder_id === id);
    const ev = ((events ?? []) as { founder_id: string; kind: string; count: number; created_at: string }[]).filter((e) => e.founder_id === id);
    const imports = ev.filter((e) => e.kind === "import");
    const p = ((profiles ?? []) as { id: string; full_name: string | null; email: string | null }[]).find((x) => x.id === id);
    const tier = tiers.find((t) => t.key === (a?.tier ?? "free")) ?? FREE_TIER;
    const stats = await sendStats(id, companyOf.get(id) ?? null);
    const row: Omit<UsageRow, "flag"> = {
      founderId: id,
      name: p?.full_name ?? p?.email ?? "Founder",
      email: p?.email ?? null,
      company: companyName.get(companyOf.get(id) ?? "") ?? null,
      tier: tier.label,
      holdLimit: tier.hold_limit,
      status: a?.status ?? "active",
      held: heldOf.get(id) ?? 0,
      imports30d: imports.reduce((s, e) => s + e.count, 0),
      importsInWindow: imports.filter((e) => e.created_at >= sinceWindow).reduce((s, e) => s + e.count, 0),
      sent: stats.sent,
      replied: stats.replied,
      bounced: stats.bounced,
      lastActive: ev.map((e) => e.created_at).sort().at(-1) ?? a?.terms_accepted_at ?? null,
      termsAcceptedAt: a?.terms_accepted_at ?? null,
    };
    out.push({ ...row, flag: usageFlag({ status: row.status, importsInWindow: row.importsInWindow, sent: row.sent, bounced: row.bounced }, settings) });
  }
  const order: Record<UsageFlag, number> = { review: 0, spike: 1, paused: 2, suspended: 3, normal: 4 };
  return out.sort((x, y) => order[x.flag] - order[y.flag] || (y.lastActive ?? "").localeCompare(x.lastActive ?? ""));
}

export type EmailLogItem = { kind: "sent" | "received" | "bounced"; name: string; at: string; status: string };

/** One founder's record: usage numbers plus the email log (sent, received, bounced). */
export async function founderUsageDetail(founderId: string, settings: DirectorySettings) {
  const usage = (await listUsage(settings)).find((u) => u.founderId === founderId) ?? null;
  const companyId = await companyIdFor(founderId);
  const since = new Date(Date.now() - 15 * 86400000).toISOString();
  const recipients = await recipientsFor(companyId);
  const [bounces, events] = await Promise.all([
    bouncesTo(recipients.map((r) => r.email).filter((e): e is string => Boolean(e))),
    db().from("investor_directory_events").select("kind, count, detail, created_at").eq("founder_id", founderId).order("created_at", { ascending: false }).limit(50),
  ]);
  const log: EmailLogItem[] = [];
  for (const r of recipients.slice(0, 200)) {
    const who = r.name ?? r.email ?? "Investor";
    log.push({ kind: "sent", name: who, at: r.last_sent_at, status: r.clicked_at ? "Clicked" : r.opened_at ? "Opened" : "Sent" });
    if (r.replied_at) log.push({ kind: "received", name: who, at: r.replied_at, status: "Reply" });
  }
  for (const b of bounces) log.push({ kind: "bounced", name: b.to_email, at: b.bounced_at, status: "Bounced" });
  log.sort((x, y) => y.at.localeCompare(x.at));

  // Sends per day for the last 15 days, PT calendar days.
  const day = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date(iso));
  const days: { day: string; sent: number }[] = [];
  for (let i = 14; i >= 0; i--) days.push({ day: day(new Date(Date.now() - i * 86400000).toISOString()), sent: 0 });
  for (const r of recipients) if (r.last_sent_at >= since) {
    const k = day(r.last_sent_at);
    const slot = days.find((x) => x.day === k);
    if (slot) slot.sent++;
  }
  const opened = recipients.filter((r) => r.opened_at).length;
  return { usage, log: log.slice(0, 100), perDay: days, opened, events: (events.data ?? []) as { kind: string; count: number; detail: string | null; created_at: string }[] };
}

/** Every source name in the directory, for the admin Source filter. */
export async function allSources(): Promise<string[]> {
  const { data } = await db().from("investor_directory").select("source").limit(50000);
  return [...new Set(((data ?? []) as { source: string }[]).map((r) => r.source))].sort();
}
