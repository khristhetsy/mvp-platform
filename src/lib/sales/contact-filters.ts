// Shared contact-list filter application. Used by the list endpoint, the group-count
// facets endpoint, and the bulk-assign endpoint so "select all matching" targets
// exactly the rows the list shows. Keep this the single source of truth for filters.

// Questionnaire facets stored as jsonb arrays under raw.__profile.<key>; filtered via
// jsonb containment (@>). Values within a facet are OR'd; different facets are AND'd.
export const FACET_KEYS = ["industries", "capital", "fundingStages", "investorTypes", "operatingStages"] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFacetFilters(query: any, p: URLSearchParams): any {
  for (const key of FACET_KEYS) {
    const vals = p.getAll(key).map((s) => s.trim()).filter((v) => v && !v.includes(",") && !v.includes('"'));
    if (!vals.length) continue;
    query = query.or(vals.map((v) => `raw->__profile->${key}.cs.["${v}"]`).join(","));
  }
  return query;
}

// Global search + per-column contains + country + facets. Mirrors the Contacts list.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyContactFilters(query: any, p: URLSearchParams): any {
  const q = p.get("q")?.trim();
  if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,company.ilike.%${q}%,phone.ilike.%${q}%`);
  for (const col of ["name", "company", "email", "phone"]) {
    const v = p.get(col)?.trim();
    if (v) query = query.ilike(col, `%${v}%`);
  }
  const countries = p.get("country")?.split(",").map((s) => s.trim()).filter(Boolean);
  if (countries && countries.length) query = query.in("country", countries);
  // Lead source is a scalar in overrides.lead_source (Form D + edits) or the Odoo
  // profile (raw.__profile.leadSource). Match either. OR'd across selected values.
  const leadSources = p.getAll("leadSource").map((s) => s.trim()).filter((v) => v && !v.includes(",") && !v.includes('"') && !v.includes("("));
  if (leadSources.length) {
    query = query.or(leadSources.flatMap((v) => [`overrides->>lead_source.eq.${v}`, `raw->__profile->>leadSource.eq.${v}`]).join(","));
  }
  query = applyFacetFilters(query, p);
  return query;
}

// ── Derived "Score presence" filter ────────────────────────────────────────
// The Contacts Filters dropdown has a role-contextual Score checkbox:
//   Role = Founder → "CRR Score"      (hasScore=crr)
//   Role = Investor → "Investor Score" (hasScore=investor)
// Neither score is a column on crm_contacts — CRR comes from companies.readiness_score
// and the Investor rating from a member's Partner Score (+ Form D bonus). So we resolve
// an allowlist of qualifying contact emails, then constrain the query by email.
// This is async (needs its own reads), so callers await it after applyContactFilters.
const SCORE_EMAIL_CAP = 8000;

// Founders whose linked company has a readiness_score → their profile emails (lowercased).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function crrScoredEmails(db: any): Promise<string[]> {
  const founderIds: string[] = [];
  const PAGE = 1000;
  for (let from = 0; from < SCORE_EMAIL_CAP; from += PAGE) {
    const { data, error } = await db
      .from("companies")
      .select("founder_id")
      .not("readiness_score", "is", null)
      .range(from, from + PAGE - 1);
    const batch = (data ?? []) as Array<{ founder_id: string | null }>;
    if (error || batch.length === 0) break;
    for (const r of batch) if (r.founder_id) founderIds.push(r.founder_id);
    if (batch.length < PAGE) break;
  }
  return emailsForProfiles(db, [...new Set(founderIds)]);
}

// Investor members whose Partner Score is numeric (rated or Form-D-bonused) →
// their profile emails (lowercased). Form D contacts are allowed separately via source.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function investorScoredEmails(db: any): Promise<string[]> {
  const { loadPartnerScoresBatch } = await import("@/lib/investor-rating/snapshot");
  const memberIds: string[] = [];
  const PAGE = 1000;
  for (let from = 0; from < SCORE_EMAIL_CAP; from += PAGE) {
    const { data, error } = await db
      .from("investor_profiles")
      .select("profile_id")
      .range(from, from + PAGE - 1);
    const batch = (data ?? []) as Array<{ profile_id: string | null }>;
    if (error || batch.length === 0) break;
    for (const r of batch) if (r.profile_id) memberIds.push(r.profile_id);
    if (batch.length < PAGE) break;
  }
  const ids = [...new Set(memberIds)];
  if (!ids.length) return [];
  const scores = await loadPartnerScoresBatch(db, ids);
  const scoredIds = ids.filter((id) => (scores.get(id)?.score ?? null) != null);
  return emailsForProfiles(db, scoredIds);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function emailsForProfiles(db: any, ids: string[]): Promise<string[]> {
  const out = new Set<string>();
  for (let i = 0; i < ids.length; i += 1000) {
    const chunk = ids.slice(i, i + 1000);
    const { data } = await db.from("profiles").select("email").in("id", chunk);
    for (const r of (data ?? []) as Array<{ email: string | null }>) {
      if (r.email) out.add(r.email.toLowerCase());
    }
  }
  return [...out];
}

// Constrain a contacts query to those that HAVE the role's derived score. Returns the
// query unchanged when no score filter is requested. An empty allowlist forces no rows
// (a ticked filter with zero matches shows nothing, never everything).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function applyScorePresenceFilter(query: any, p: URLSearchParams, db: any): Promise<any> {
  const hasScore = p.get("hasScore");
  if (hasScore !== "crr" && hasScore !== "investor") return query;

  if (hasScore === "crr") {
    const emails = await crrScoredEmails(db);
    if (!emails.length) return query.in("email", ["__none__"]);
    return query.in("email", emails);
  }

  // hasScore === "investor": member-scored emails OR any Form D contact (gets the bonus).
  const emails = await investorScoredEmails(db);
  if (!emails.length) return query.eq("source", "formd");
  const list = emails.map((e) => `"${e}"`).join(",");
  return query.or(`source.eq.formd,email.in.(${list})`);
}
