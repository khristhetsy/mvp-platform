// Marketing Hub · Prospects — Founder profiles as a Stage 1 source.
// Reads the platform's real founder data: profiles(role='founder') joined to
// companies and company_readiness_scores. Admin-only (service-role client) so
// readiness (investor/admin-gated) is available here.
//
// Defensive multi-query + JS assembly rather than PostgREST embedding, so it
// doesn't depend on FK-relationship names being registered.

import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { splitName } from "@/lib/contacts/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

export interface FounderFilters {
  stage?: string;        // initialize | qualify | deploy | optimize
  sector?: string;       // companies.industry (contains match)
  jurisdiction?: string; // companies.incorporation_jurisdiction (contains)
  minReadiness?: number; // company_readiness_scores.effective_score >=
  minFunding?: number;   // companies.funding_amount >=
  search?: string;       // name / email
}

export interface FounderRow {
  id: string;            // profiles.id
  name: string | null;
  email: string | null;
  journey_stage: string | null;
  company: string | null;
  industry: string | null;
  jurisdiction: string | null;
  funding_amount: number | null;
  readiness: number | null;
}

const FOUNDER_CAP = 4000; // bound the working set for admin filtering

async function loadFounders(f: FounderFilters): Promise<FounderRow[]> {
  const db = serviceRoleClientUntyped();

  // 1) founders (filter on profile-level fields)
  let pq = db.from("profiles").select("id, full_name, email, journey_stage").eq("role", "founder");
  if (f.stage) pq = pq.eq("journey_stage", f.stage);
  if (f.search) pq = pq.or(`full_name.ilike.%${f.search}%,email.ilike.%${f.search}%`);
  const { data: profs } = await pq.limit(FOUNDER_CAP);
  const founders = (profs ?? []) as Row[];
  if (founders.length === 0) return [];
  const founderIds = founders.map((p) => p.id);

  // 2) their companies (filter on company-level fields)
  const companyFiltered = !!(f.sector || f.jurisdiction || typeof f.minFunding === "number");
  const compByFounder = new Map<string, Row>();
  const companyIds: string[] = [];
  for (let i = 0; i < founderIds.length; i += 300) {
    const chunk = founderIds.slice(i, i + 300);
    let cq = db.from("companies").select("id, founder_id, company_name, industry, incorporation_jurisdiction, funding_amount").in("founder_id", chunk);
    if (f.sector) cq = cq.ilike("industry", `%${f.sector}%`);
    if (f.jurisdiction) cq = cq.ilike("incorporation_jurisdiction", `%${f.jurisdiction}%`);
    if (typeof f.minFunding === "number" && f.minFunding > 0) cq = cq.gte("funding_amount", f.minFunding);
    const { data } = await cq;
    for (const c of (data ?? []) as Row[]) { compByFounder.set(c.founder_id, c); companyIds.push(c.id); }
  }

  // 3) readiness for those companies
  const readinessByCompany = new Map<string, number>();
  if (companyIds.length > 0) {
    for (let i = 0; i < companyIds.length; i += 300) {
      const chunk = companyIds.slice(i, i + 300);
      const { data } = await db.from("company_readiness_scores").select("company_id, effective_score").in("company_id", chunk);
      for (const r of (data ?? []) as Row[]) if (typeof r.effective_score === "number") readinessByCompany.set(r.company_id, r.effective_score);
    }
  }

  const rows: FounderRow[] = [];
  for (const p of founders) {
    const c = compByFounder.get(p.id);
    // company filters set → require a matching company
    if (companyFiltered && !c) continue;
    const readiness = c ? readinessByCompany.get(c.id) ?? null : null;
    if (typeof f.minReadiness === "number" && f.minReadiness > 0 && (readiness ?? -1) < f.minReadiness) continue;
    rows.push({
      id: p.id,
      name: p.full_name ?? null,
      email: p.email ?? null,
      journey_stage: p.journey_stage ?? null,
      company: c?.company_name ?? null,
      industry: c?.industry ?? null,
      jurisdiction: c?.incorporation_jurisdiction ?? null,
      funding_amount: c?.funding_amount ?? null,
      readiness,
    });
  }
  // highest readiness first, then name
  rows.sort((a, b) => (b.readiness ?? -1) - (a.readiness ?? -1));
  return rows;
}

export interface FounderListResult {
  rows: FounderRow[];
  total: number;
}

/** Filtered founder profiles for the Stage 1 source (bounded, with a preview slice). */
export async function getFounderProfiles(f: FounderFilters, previewLimit = 50): Promise<FounderListResult> {
  const all = await loadFounders(f);
  return { rows: all.slice(0, previewLimit), total: all.length };
}

const SAVE_CAP = 20000;

export interface SaveFoundersResult {
  listId: string;
  listName: string;
  added: number;
}

/**
 * Snapshot the matching founders (or an explicit id subset) into a Marketing Hub
 * list. Founder emails become marketing_contacts tagged source 'founder_profile'.
 */
export async function saveFoundersToList(
  f: FounderFilters,
  target: { name?: string; listId?: string; contactIds?: string[] },
): Promise<SaveFoundersResult> {
  const db = serviceRoleClientUntyped();

  let listId = target.listId ?? null;
  let listName = "";
  if (listId) {
    const { data } = await db.from("marketing_lists").select("id, name").eq("id", listId).single();
    if (!data) throw new Error("List not found.");
    listName = data.name as string;
  } else {
    const name = (target.name ?? "").trim();
    if (!name) throw new Error("A list name is required.");
    const { data, error } = await db.from("marketing_lists").insert({ name }).select("id, name").single();
    if (error || !data) throw new Error(error?.message ?? "Could not create list.");
    listId = data.id as string;
    listName = data.name as string;
  }

  let founders = await loadFounders(f);
  if (target.contactIds && target.contactIds.length > 0) {
    const keep = new Set(target.contactIds);
    founders = founders.filter((r) => keep.has(r.id));
  }
  founders = founders.filter((r) => r.email).slice(0, SAVE_CAP);

  let added = 0;
  const seen = new Set<string>();
  for (let i = 0; i < founders.length; i += 1000) {
    const page = founders.slice(i, i + 1000);
    const mc = page
      .filter((r) => r.email && !seen.has(r.email.toLowerCase()) && seen.add(r.email.toLowerCase()))
      .map((r) => {
        const { first, last } = splitName(r.name);
        return { email: (r.email as string).toLowerCase(), first_name: first, last_name: last, company: r.company, source: "founder_profile" };
      });
    if (mc.length === 0) continue;
    const { data: upserted } = await db.from("marketing_contacts").upsert(mc, { onConflict: "email" }).select("id");
    const memberships = ((upserted ?? []) as Row[]).map((c) => ({ list_id: listId, contact_id: c.id }));
    if (memberships.length > 0) {
      await db.from("marketing_list_contacts").upsert(memberships, { onConflict: "list_id,contact_id" });
      added += memberships.length;
    }
  }

  return { listId: listId as string, listName, added };
}
