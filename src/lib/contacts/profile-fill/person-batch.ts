/**
 * Batches of the free person search (server only). Picks LinkedIn contacts still missing
 * an email or phone whose firm website is known, investors first, reads the firm's pages
 * and stores what it finds as proposals for review. Contacts with no known website are
 * marked and left alone: finding a website needs a search engine, which costs money.
 */
import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { companyKeyOf } from "@/lib/contacts/profile-fill/fields";
import { searchPerson } from "@/lib/contacts/profile-fill/person-search";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export type PersonGroup = "investor" | "all";

export type PersonRow = {
  contactId: string;
  name: string | null;
  company: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  phoneKind: "direct" | "office" | null;
  result: "found" | "office_only" | "not_listed" | "no_website" | "no_name";
};

export type PersonBatch = { contacts: number; rows: PersonRow[]; outOfTime: boolean };

type Pending = {
  id: string; name: string | null; company: string | null; email: string | null; phone: string | null;
  website: string | null; company_domain: string | null; raw: Record<string, unknown> | null; side: string | null;
};

function nameParts(c: Pending): { first: string; last: string } | null {
  const li = (c.raw?.linkedin ?? null) as { firstName?: string; lastName?: string } | null;
  const first = (li?.firstName ?? "").trim() || (c.name ?? "").trim().split(/\s+/)[0] || "";
  const last = (li?.lastName ?? "").trim() || (c.name ?? "").trim().split(/\s+/).slice(1).join(" ");
  return first && last ? { first, last } : null;
}

const isInvestor = (c: Pending) => c.side === "investor" || (c.raw?.linkedin as { group?: string } | undefined)?.group === "investor";

/** Contacts left to search in a group, and how many have a website we can read. */
export async function personStats(group: PersonGroup): Promise<{ pending: number; searched: number }> {
  let q = db().from("crm_contacts").select("id", { count: "exact", head: true }).not("linkedin_slug", "is", null).is("person_search_at", null).or("email.is.null,email.eq.,phone.is.null,phone.eq.");
  if (group === "investor") q = q.or("side.eq.investor,raw->linkedin->>group.eq.investor");
  const { count: pending } = await q;
  const { count: searched } = await db().from("crm_contacts").select("id", { count: "exact", head: true }).not("person_search_at", "is", null);
  return { pending: pending ?? 0, searched: searched ?? 0 };
}

export async function runPersonBatch(group: PersonGroup, limit: number, timeBudgetMs: number): Promise<PersonBatch> {
  const started = Date.now();
  let q = db().from("crm_contacts")
    .select("id, name, company, email, phone, website, company_domain, raw, side")
    .not("linkedin_slug", "is", null).is("person_search_at", null)
    .or("email.is.null,email.eq.,phone.is.null,phone.eq.")
    .order("side", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (group === "investor") q = q.or("side.eq.investor,raw->linkedin->>group.eq.investor");
  const { data, error } = await q;
  if (error) throw new Error(error.message.includes("person_search_at") ? "The profile fill migration hasn't been run yet." : error.message);
  const pending = ((data ?? []) as Pending[]).sort((a, b) => Number(isInvestor(b)) - Number(isInvestor(a)));

  // Websites from the research file, for contacts that have none of their own.
  const keys = [...new Set(pending.filter((p) => !p.website && !p.company_domain && p.company).map((p) => companyKeyOf(p.company as string)))];
  const siteByCompany = new Map<string, string>();
  if (keys.length) {
    const { data: cs } = await db().from("company_summaries").select("company_key, website").in("company_key", keys).not("website", "is", null);
    for (const r of (cs ?? []) as Array<{ company_key: string; website: string }>) siteByCompany.set(r.company_key, r.website);
  }
  const { data: ws } = await db().from("contact_fill_suggestions").select("contact_id, value").eq("field", "website").eq("status", "pending").in("contact_id", pending.map((p) => p.id));
  const siteByContact = new Map(((ws ?? []) as Array<{ contact_id: string; value: string }>).map((r) => [r.contact_id, String(r.value)]));

  const rows: PersonRow[] = [];
  let outOfTime = false;
  const queue = [...pending];
  const worker = async () => {
    for (;;) {
      if (Date.now() - started > timeBudgetMs) { outOfTime = true; return; }
      const c = queue.shift();
      if (!c) return;
      const site = c.website || (c.company_domain ? `https://${c.company_domain}` : null) || siteByContact.get(c.id) || (c.company ? siteByCompany.get(companyKeyOf(c.company)) : null) || null;
      const base: PersonRow = { contactId: c.id, name: c.name, company: c.company, website: site, email: null, phone: null, phoneKind: null, result: "no_website" };
      const parts = nameParts(c);
      if (!parts) { rows.push({ ...base, result: "no_name" }); await mark(c.id); continue; }
      if (!site) { rows.push(base); await mark(c.id); continue; }
      try {
        const hit = await searchPerson(site, parts.first, parts.last, 30000);
        const proposals: Record<string, unknown>[] = [];
        if (hit.email && !c.email) {
          proposals.push({ contact_id: c.id, field: "email", value: hit.email, label: "found", source_url: hit.page, basis: "Published on the firm's site with their name", confidence: "high", origin: "person_search" });
        }
        if (hit.phone && !c.phone) {
          proposals.push({
            contact_id: c.id, field: "phone", value: hit.phone, label: "found", source_url: hit.page,
            basis: hit.phoneKind === "direct" ? "Direct line, listed with their name on the firm's site" : "Office line, the firm's main number",
            confidence: hit.phoneKind === "direct" ? "high" : "medium", origin: "person_search",
          });
        }
        if (proposals.length) {
          await db().from("contact_fill_suggestions").delete().eq("contact_id", c.id).eq("status", "pending").in("field", proposals.map((p) => p.field as string));
          await db().from("contact_fill_suggestions").insert(proposals);
        }
        rows.push({
          ...base,
          email: hit.email && !c.email ? hit.email : null,
          phone: hit.phone && !c.phone ? hit.phone : null,
          phoneKind: hit.phone && !c.phone ? hit.phoneKind : null,
          result: hit.email || hit.phoneKind === "direct" ? "found" : hit.phone ? "office_only" : "not_listed",
        });
      } catch (e) {
        console.error("[person-search] failed:", c.id, e instanceof Error ? e.message : e);
        rows.push({ ...base, result: "not_listed" });
      }
      await mark(c.id);
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  return { contacts: rows.length, rows, outOfTime };
}

async function mark(id: string): Promise<void> {
  await db().from("crm_contacts").update({ person_search_at: new Date().toISOString() }).eq("id", id);
}
