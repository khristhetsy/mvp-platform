// Form D connector — server data access (build spec §7, §8, §9, §11). Reads/writes
// the formd_* mirror tables and the CRM crm_contacts table via the service role.
// Filters run at QUERY time (§7): every filing is stored, nothing discarded.

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { normalizeName, normalizePhone } from "./dedupe";
import { amountBand, revenueBand, fundingStageOption, investorTypeOptions, businessEntityStatus } from "./profile-map";

function db(): SupabaseClient {
  return serviceRoleClientUntyped() as unknown as SupabaseClient;
}

export type SavedView = "eligible" | "stall_window" | "aging_in" | "agent_watch" | "all";

export type FilingRow = {
  accessionNo: string;
  cik: string;
  formType: string;
  dateFiled: string | null;
  companyName: string;
  city: string | null;
  state: string | null;
  isFund: boolean;
  totalRemaining: number | null;
  pctSold: number | null;
  daysSinceFirstSale: number | null;
  saleYetToOccur: boolean;
  hasPlacementAgent: boolean;
  is506c: boolean;
  formdScore: number | null;
  derivedFundingStage: string | null;
  derivedInvestorType: string | null;
  scoreNotes: string | null;
  filingUrl: string | null;
  promotedContactId: string | null;
  promotedAt: string | null;
  heldForReview: boolean;
};

const SELECT =
  "accession_no, cik, form_type, date_filed, company_name, city, state, is_fund, total_remaining, pct_sold, days_since_first_sale, sale_yet_to_occur, has_placement_agent, is_506c, formd_score, derived_funding_stage, derived_investor_type, score_notes, filing_url, promoted_contact_id, promoted_at, held_for_review";

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapRow(r: any): FilingRow {
  return {
    accessionNo: r.accession_no, cik: r.cik, formType: r.form_type, dateFiled: r.date_filed ?? null,
    companyName: r.company_name, city: r.city ?? null, state: r.state ?? null, isFund: Boolean(r.is_fund),
    totalRemaining: r.total_remaining ?? null, pctSold: r.pct_sold ?? null,
    daysSinceFirstSale: r.days_since_first_sale ?? null, saleYetToOccur: Boolean(r.sale_yet_to_occur),
    hasPlacementAgent: Boolean(r.has_placement_agent), is506c: Boolean(r.is_506c),
    formdScore: r.formd_score ?? null, derivedFundingStage: r.derived_funding_stage ?? null,
    derivedInvestorType: r.derived_investor_type ?? null, scoreNotes: r.score_notes ?? null,
    filingUrl: r.filing_url ?? null, promotedContactId: r.promoted_contact_id ?? null,
    promotedAt: r.promoted_at ?? null, heldForReview: Boolean(r.held_for_review),
  };
}

export type FilingFilters = {
  view?: SavedView;
  minRemaining?: number;
  minScore?: number;
  isFund?: boolean;
  hasAgent?: boolean;
  is506c?: boolean;
  daysMin?: number;
  daysMax?: number;
  pipeline?: "unpromoted" | "promoted" | "held" | "all";
  limit?: number;
};

/** Apply a saved view + ad-hoc filters at query time. Returns rows + count. */
export async function listFilings(filters: FilingFilters = {}): Promise<{ rows: FilingRow[]; count: number }> {
  const v = filters.view ?? "eligible";
  let q = db().from("formd_filings").select(SELECT, { count: "exact" }).order("formd_score", { ascending: false });

  // Saved views (§7).
  if (v === "eligible") q = q.eq("is_fund", false).eq("has_placement_agent", false).gte("total_remaining", 1_000_000).gte("formd_score", 70).is("promoted_contact_id", null);
  else if (v === "stall_window") q = q.gte("formd_score", 70).eq("has_placement_agent", false).gte("days_since_first_sale", 90).lte("days_since_first_sale", 365).is("promoted_contact_id", null);
  else if (v === "aging_in") q = q.gte("days_since_first_sale", 60).lte("days_since_first_sale", 89).gte("total_remaining", 1_000_000).is("promoted_contact_id", null);
  else if (v === "agent_watch") q = q.eq("has_placement_agent", true);
  // "all" → no base filter.

  // Ad-hoc overrides.
  if (filters.minRemaining != null) q = q.gte("total_remaining", filters.minRemaining);
  if (filters.minScore != null) q = q.gte("formd_score", filters.minScore);
  if (filters.isFund != null) q = q.eq("is_fund", filters.isFund);
  if (filters.hasAgent != null) q = q.eq("has_placement_agent", filters.hasAgent);
  if (filters.is506c != null) q = q.eq("is_506c", filters.is506c);
  if (filters.daysMin != null) q = q.gte("days_since_first_sale", filters.daysMin);
  if (filters.daysMax != null) q = q.lte("days_since_first_sale", filters.daysMax);
  if (filters.pipeline === "unpromoted") q = q.is("promoted_contact_id", null);
  else if (filters.pipeline === "promoted") q = q.not("promoted_contact_id", "is", null);
  else if (filters.pipeline === "held") q = q.eq("held_for_review", true);

  q = q.limit(filters.limit ?? 200);
  const { data, count, error } = await q;
  if (error) throw new Error(error.message);
  return { rows: (data ?? []).map(mapRow), count: count ?? 0 };
}

export type FormDStats = { mirrored: number; operating: number; funds: number; unpromoted: number; promoted: number };

export async function getFormDStats(): Promise<FormDStats> {
  const client = db();
  const head = async (build: (q: any) => any): Promise<number> => {
    const { count } = await build(client.from("formd_filings").select("accession_no", { count: "exact", head: true }));
    return count ?? 0;
  };
  const [mirrored, funds, promoted, unpromoted] = await Promise.all([
    head((q) => q),
    head((q) => q.eq("is_fund", true)),
    head((q) => q.not("promoted_contact_id", "is", null)),
    head((q) => q.is("promoted_contact_id", null)),
  ]);
  return { mirrored, operating: mirrored - funds, funds, unpromoted, promoted };
}

export async function getFilingDetail(accessionNo: string): Promise<{ filing: any; relatedPersons: any[] } | null> {
  const client = db();
  const { data: filing } = await client.from("formd_filings").select("*").eq("accession_no", accessionNo).maybeSingle();
  if (!filing) return null;
  const { data: rp } = await client.from("formd_related_persons").select("*").eq("accession_no", accessionNo).order("is_signer", { ascending: false });
  return { filing, relatedPersons: rp ?? [] };
}

// ── Promote (§8) with the §9 dedupe cascade ─────────────────────────────────

const usd = (n: number | null) => (n == null ? null : `$${Number(n).toLocaleString("en-US")}`);

export type PromoteResult =
  | { action: "created" | "updated" | "linked"; contactId: string }
  | { action: "possible_match"; contactId: string; contactName: string };

// raw.__profile.extra is an OBJECT keyed by label; each value mirrors the Odoo
// shape (selection/many2many fields are stored as string arrays). Every value
// below is snapped onto an option that ALREADY exists in the CRM vocabulary via
// profile-map — we never invent a new category. Unmappable values are omitted.
function buildProfileExtra(filing: any, mgmtTeam: string): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  const putArr = (label: string, vals: string[]) => { if (vals.length) out[label] = vals; };
  const putOne = (label: string, val: string | null) => { if (val) out[label] = [val]; };

  // Raise size → the band it falls in (target amount; else remaining). Exact
  // figures are preserved in the contact note, not the dropdown.
  putOne("Entrepreneur seeking amount of capital?", amountBand(filing.total_offering ?? filing.total_remaining));
  putArr("Entrepreneur seeking type of investor(s)?", investorTypeOptions(filing.derived_investor_type));
  putOne("Entrepreneur type(s) of business entity?", businessEntityStatus());
  putOne("Entrepreneur funding stage?", fundingStageOption(filing.derived_funding_stage));
  putOne("Entrepreneur annual revenue size?", revenueBand(filing.revenue_range));
  // Management team is free text (no controlled options), so keep it as a string.
  if (mgmtTeam) out["Entrepreneur management team experience?"] = mgmtTeam;
  return out;
}

/** Human-readable raise line for the contact note (exact figures, not banded). */
function raiseDetail(filing: any): string {
  const parts: string[] = [];
  if (filing.total_offering != null) parts.push(`${usd(filing.total_offering)} target`);
  if (filing.total_sold != null) parts.push(`${usd(filing.total_sold)} raised${filing.pct_sold != null ? ` (${filing.pct_sold}% sold)` : ""}`);
  if (filing.total_remaining != null) parts.push(`${usd(filing.total_remaining)} remaining`);
  return parts.join(" · ");
}

/**
 * Promote a filing to a CRM contact (§8) with the §9 dedupe cascade:
 *  1) same CIK → update. 2) name+phone match → possible_match (admin decides).
 *  3) create. `resolve` lets the admin force create or link after a possible match.
 */
export async function promoteFiling(
  accessionNo: string,
  actorId: string,
  opts: { resolve?: "create" | "link"; contactId?: string } = {},
): Promise<PromoteResult> {
  const client = db();
  const detail = await getFilingDetail(accessionNo);
  if (!detail) throw new Error("Filing not found.");
  const f = detail.filing;
  const persons = detail.relatedPersons;

  const fullName = f.signer_name || persons[0]?.full_name || f.company_name;
  const mgmtTeam = persons.map((p: any) => `${p.full_name}${p.relationships ? ` (${p.relationships})` : ""}`).join("; ");
  const raise = raiseDetail(f);
  const noteText = `SEC Form D lead · score ${f.formd_score ?? "—"} · ${f.days_since_first_sale ?? "?"}d since first sale · agent: ${f.has_placement_agent ? "yes" : "no"}${raise ? ` · raise: ${raise}` : ""} · ${f.filing_url ?? ""}`;

  // 1) already promoted by CIK → update the still-to-raise figure + note.
  const { data: byCik } = await client.from("crm_contacts").select("id, raw").eq("formd_cik", f.cik).maybeSingle();
  if (byCik) {
    const raw = byCik.raw ?? {};
    raw.__profile = raw.__profile ?? {};
    raw.__profile.extra = buildProfileExtra(f, mgmtTeam);
    raw.note = noteText;
    await client.from("crm_contacts").update({ raw, formd_accession_no: accessionNo }).eq("id", byCik.id);
    await client.from("formd_filings").update({ promoted_contact_id: byCik.id, promoted_at: new Date().toISOString() }).eq("accession_no", accessionNo);
    return { action: "updated", contactId: byCik.id };
  }

  // Explicit link chosen by the admin after a possible match.
  if (opts.resolve === "link" && opts.contactId) {
    const raw2: any = {};
    raw2.__profile = { extra: buildProfileExtra(f, mgmtTeam) };
    raw2.note = noteText;
    await client.from("crm_contacts").update({ formd_cik: f.cik, formd_accession_no: accessionNo, raw: raw2 }).eq("id", opts.contactId);
    await client.from("formd_filings").update({ promoted_contact_id: opts.contactId, promoted_at: new Date().toISOString() }).eq("accession_no", accessionNo);
    return { action: "linked", contactId: opts.contactId };
  }

  // 2) name + phone match → surface, don't auto-merge (unless forcing create).
  if (opts.resolve !== "create" && f.phone) {
    const { data: candidates } = await client.from("crm_contacts").select("id, name, company, phone").eq("phone", f.phone);
    const wantName = normalizeName(f.company_name);
    const wantPhone = normalizePhone(f.phone);
    const match = (candidates ?? []).find((c: any) => normalizeName(c.company) === wantName && normalizePhone(c.phone) === wantPhone);
    if (match) return { action: "possible_match", contactId: match.id, contactName: match.name ?? match.company ?? "Existing contact" };
  }

  // 3) create.
  const row = {
    source: "formd",
    external_id: `formd:${f.cik}`,
    // contact_type is a GENERATED column (CASE on module → 'founder'); never write it.
    module: "founder",
    side: "founder",
    name: fullName,
    email: null,
    company: f.company_name,
    phone: f.phone,
    website: null,
    lead_status: "new",
    plan: "Entrepreneur",
    tags: ["SEC Form D"],
    raw: { __profile: { extra: buildProfileExtra(f, mgmtTeam) }, note: noteText, imported_via: "formd", filing_url: f.filing_url },
    overrides: {
      lead_source: "SEC Form D",
      membership: "Entrepreneur",
      language: "English",
      city: f.city,
      state: f.state,
      country: "United States",
    },
    formd_cik: f.cik,
    formd_accession_no: accessionNo,
    // Assign to whoever promoted it, so it's visible in the owner-scoped Sales Hub
    // Contacts list (unassigned contacts only show in a see-all view). Mirrors the
    // manual "Add contact" path.
    assignee_ids: [actorId],
    // created_on is a DB-generated column — never insert a value (§ promote fix).
  };
  const { data: inserted, error } = await client.from("crm_contacts").upsert(row, { onConflict: "source,external_id" }).select("id").single();
  if (error) throw new Error(error.message);
  await client.from("formd_filings").update({ promoted_contact_id: inserted.id, promoted_at: new Date().toISOString() }).eq("accession_no", accessionNo);
  return { action: "created", contactId: inserted.id };
}

/** Mark/unmark a filing held for review. */
export async function setFilingHeld(accessionNo: string, held: boolean): Promise<void> {
  const { error } = await db().from("formd_filings").update({ held_for_review: held }).eq("accession_no", accessionNo);
  if (error) throw new Error(error.message);
}

/** Test connection (§11.1): one EDGAR index fetch confirming 200 + no rate-limit. */
export async function testConnection(userAgent: string | undefined): Promise<{ ok: boolean; status: number; message: string }> {
  const ua = userAgent?.trim();
  if (!ua) return { ok: false, status: 0, message: "SEC_USER_AGENT is not set — the job cannot run without a declared contact." };
  try {
    const res = await fetch("https://www.sec.gov/Archives/edgar/daily-index/", { headers: { "User-Agent": ua, "Accept-Encoding": "gzip, deflate" } });
    if (res.status === 429 || res.status === 403) return { ok: false, status: res.status, message: `EDGAR returned ${res.status} — rate limit or User-Agent problem.` };
    return { ok: res.ok, status: res.status, message: res.ok ? "Connected to EDGAR." : `EDGAR returned ${res.status}.` };
  } catch (e) {
    return { ok: false, status: 0, message: e instanceof Error ? e.message : "Could not reach EDGAR." };
  }
}

export type HealthCheck = { name: string; value: string; severity: "ok" | "warn" | "page" };

/** Read-time health snapshot (§12). Silent failure looks like a quiet news day. */
export async function getFormDHealth(): Promise<HealthCheck[]> {
  const client = db();
  const checks: HealthCheck[] = [];
  const today = new Date().toISOString().slice(0, 10);
  const isWeekday = ![0, 6].includes(new Date().getUTCDay());

  const headCount = async (build: (q: any) => any): Promise<number> => {
    const { count } = await build(client.from("formd_filings").select("accession_no", { count: "exact", head: true }));
    return count ?? 0;
  };

  const filedToday = await headCount((q) => q.eq("date_filed", today));
  if (isWeekday && filedToday === 0) checks.push({ name: "Filings today", value: "0 on a weekday", severity: "page" });
  else checks.push({ name: "Filings today", value: String(filedToday), severity: "ok" });

  // Sample the most recent 500 for null/empty rates.
  const { data: sample } = await client.from("formd_filings").select("accession_no, company_name, phone").order("created_at", { ascending: false }).limit(500);
  const rows = (sample ?? []) as any[];
  if (rows.length) {
    const noName = rows.filter((r) => !r.company_name).length / rows.length;
    checks.push({ name: "Company name null rate", value: `${(noName * 100).toFixed(1)}%`, severity: noName > 0.02 ? "page" : "ok" });

    const accs = rows.map((r) => r.accession_no);
    const { data: rp } = await client.from("formd_related_persons").select("accession_no").in("accession_no", accs);
    const withPeople = new Set((rp ?? []).map((r: any) => r.accession_no));
    const noPeople = rows.filter((r) => !withPeople.has(r.accession_no)).length / rows.length;
    checks.push({ name: "Related-persons = 0 rate", value: `${(noPeople * 100).toFixed(1)}%`, severity: noPeople > 0.3 ? "page" : "ok" });

    const noPhone = rows.filter((r) => !r.phone).length / rows.length;
    checks.push({ name: "Phone null rate", value: `${(noPhone * 100).toFixed(1)}%`, severity: noPhone > 0.4 ? "warn" : "ok" });
  }
  return checks;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
