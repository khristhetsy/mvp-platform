/**
 * Website enrichment for LinkedIn-imported contacts (server only).
 *
 * Per company, never per person: find the company's website (a website another contact
 * at that company already has, else one web search), then read the company's own contact
 * pages for a published phone and email (src/lib/append/websearch.ts, unchanged). Searches
 * bill to the Data enrichment AI budget; this module checks that budget before each
 * company and stops when it's used up, leaving the rest pending for next time.
 *
 * Duplicates: a phone already held by a contact at a different company is not copied; a
 * personal email already held by another contact merges this LinkedIn row into that
 * contact (the row was created by the import, so nothing else points at it). A company
 * mailbox (info@, contact@…) is kept as "Company email" under Details, never as the
 * person's email, so it can't make two people look like duplicates.
 */
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { assertAiBudget, isAiBudgetExceeded } from "@/lib/ai-budget/service";
import { serperCostPerSearch } from "@/lib/ai-budget/config";
import { searchCompanyContacts, searchConfigured } from "@/lib/append/websearch";
import { emailBelongsTo, isGenericEmail } from "./linkedin-import";

export type EnrichGroup = "investor" | "founder" | "other" | "all";

export interface EnrichResultRow {
  contactId: string;
  name: string | null;
  company: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  companyEmail: string | null;
  result: "enriched" | "website_only" | "no_website" | "no_company" | "merged" | "phone_elsewhere";
  note?: string;
}

export interface EnrichBatch {
  companies: number;
  rows: EnrichResultRow[];
  budgetReached: boolean;
  outOfTime: boolean;
  costUsd: number;
  notConfigured?: boolean;
}

type Pending = { id: string; name: string | null; company: string | null; email: string | null; phone: string | null; first_name: string | null; last_name: string | null; company_domain: string | null; website: string | null };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

async function enrichCompany(db: Db, company: string, people: Pending[], knownDomain: string | null): Promise<EnrichResultRow[]> {
  const found = await searchCompanyContacts({ company, domain: knownDomain ?? people.find((p) => p.company_domain)?.company_domain ?? null });
  const domain = found.domain;
  const website = domain ? `https://${domain}` : null;
  const email = found.email?.toLowerCase() ?? null;
  const phone = found.phone ?? null;

  const lookups = await db.rpc("linkedin_enrich_lookup", { p_phones: phone ? [phone] : [], p_emails: email ? [email] : [] });
  type L = { kind: "phone" | "email"; key: string; contact_id: string; contact_name: string | null; contact_company: string | null; source: string };
  const held = ((lookups.data ?? []) as L[]);
  const myIds = new Set(people.map((p) => p.id));
  const coKey = company.toLowerCase().trim();
  const phoneElsewhere = phone ? held.find((h) => h.kind === "phone" && !myIds.has(h.contact_id) && (h.contact_company ?? "").toLowerCase().trim() !== coKey) : undefined;

  const out: EnrichResultRow[] = [];
  for (const p of people) {
    const patch: Record<string, unknown> = {};
    if (domain && !p.company_domain) patch.company_domain = domain;
    if (website && !p.website) patch.website = website;

    const row: EnrichResultRow = { contactId: p.id, name: p.name, company: p.company, website, phone: null, email: null, companyEmail: null, result: domain ? "website_only" : "no_website" };

    if (phone && !p.phone) {
      if (phoneElsewhere) { row.result = "phone_elsewhere"; row.note = `Phone belongs to ${phoneElsewhere.contact_name ?? "another contact"}`; }
      else { patch.phone = phone; patch.phone_source = "site"; row.phone = phone; }
    }

    if (email) {
      if (isGenericEmail(email) || !emailBelongsTo(email, p.first_name, p.last_name)) {
        row.companyEmail = email;
      } else if (!p.email) {
        const owner = held.find((h) => h.kind === "email" && h.contact_id !== p.id);
        if (owner) {
          // Same person already in Contacts: move the LinkedIn data onto them, drop this import row.
          const { data: self } = await db.from("crm_contacts").select("raw, linkedin_slug").eq("id", p.id).maybeSingle();
          const li = (self?.raw as Record<string, unknown> | null)?.linkedin ?? null;
          await db.rpc("linkedin_import_merge", { p_rows: [{ id: owner.contact_id, slug: self?.linkedin_slug ?? null, email: null, company: p.company, position: (li as { position?: string } | null)?.position ?? null, li: li ?? {} }] });
          await db.from("crm_contacts").delete().eq("id", p.id).eq("source", "linkedin");
          out.push({ ...row, email, result: "merged", note: `Merged into ${owner.contact_name ?? "existing contact"}` });
          continue;
        }
        patch.email = email; patch.email_source = "site"; patch.email_status = "unverified"; row.email = email;
      }
    }

    if (row.result !== "phone_elsewhere" && (row.phone || row.email)) row.result = "enriched";
    patch.enrichment_status = !domain ? "no_website" : row.phone || row.email || row.companyEmail ? "enriched" : "no_contacts";

    if (row.companyEmail) {
      const { data: self } = await db.from("crm_contacts").select("raw").eq("id", p.id).maybeSingle();
      const raw = (self?.raw ?? {}) as Record<string, unknown>;
      const prof = (raw.__profile ?? {}) as Record<string, unknown>;
      const extra = (prof.extra ?? {}) as Record<string, unknown>;
      patch.raw = { ...raw, __profile: { ...prof, extra: { ...extra, "Company email": row.companyEmail } } };
    }
    await db.from("crm_contacts").update(patch).eq("id", p.id);
    out.push(row);
  }
  return out;
}

/** Run one batch: up to `limit` companies, stopping early at the time budget or the AI budget. */
export async function runEnrichBatch(group: EnrichGroup, limit: number, timeBudgetMs: number): Promise<EnrichBatch> {
  const db: Db = serviceRoleClientUntyped();
  const started = Date.now();
  const startIso = new Date(started - 1000).toISOString();
  if (!searchConfigured()) return { companies: 0, rows: [], budgetReached: false, outOfTime: false, costUsd: 0, notConfigured: true };

  const perCompany = serperCostPerSearch() * 2;
  try { await assertAiBudget("enrichment", perCompany); }
  catch (e) { if (isAiBudgetExceeded(e)) return { companies: 0, rows: [], budgetReached: true, outOfTime: false, costUsd: 0 }; throw e; }

  const { data, error } = await db.rpc("linkedin_enrich_next", { p_group: group, p_limit: limit });
  if (error) throw new Error(error.message);
  const pending = (data ?? []) as Pending[];

  const byCo = new Map<string, Pending[]>();
  for (const p of pending) {
    const k = (p.company ?? "").toLowerCase().trim();
    byCo.set(k, [...(byCo.get(k) ?? []), p]);
  }

  const rows: EnrichResultRow[] = [];
  // No company: nothing to search for.
  const blank = byCo.get("") ?? [];
  byCo.delete("");
  if (blank.length) {
    await db.from("crm_contacts").update({ enrichment_status: "no_website" }).in("id", blank.map((p) => p.id));
    for (const p of blank) rows.push({ contactId: p.id, name: p.name, company: null, website: null, phone: null, email: null, companyEmail: null, result: "no_company" });
  }

  const names = [...byCo.values()].map((ps) => (ps[0].company ?? "").trim());
  const known = new Map<string, string>();
  if (names.length) {
    const { data: kd } = await db.rpc("linkedin_known_domains", { p_companies: names.map((n) => n.toLowerCase()) });
    for (const r of (kd ?? []) as Array<{ company: string; domain: string }>) {
      const d = r.domain.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].toLowerCase();
      if (d) known.set(r.company.toLowerCase().trim(), d);
    }
  }

  let budgetReached = false, outOfTime = false, done = 0;
  const queue = [...byCo.entries()];
  const worker = async () => {
    for (;;) {
      if (budgetReached || outOfTime) return;
      if (Date.now() - started > timeBudgetMs) { outOfTime = true; return; }
      const next = queue.shift();
      if (!next) return;
      const [key, people] = next;
      try { await assertAiBudget("enrichment", perCompany); }
      catch (e) { if (isAiBudgetExceeded(e)) { budgetReached = true; return; } }
      try {
        rows.push(...await enrichCompany(db, (people[0].company ?? key).trim(), people, known.get(key) ?? null));
      } catch (e) {
        console.error("[linkedin-enrich] company failed:", key, e instanceof Error ? e.message : e);
      }
      done++;
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));

  const { data: spend } = await db.from("ai_spend_events").select("cost_usd").eq("vendor", "serper").eq("category", "enrichment").gte("created_at", startIso);
  const costUsd = ((spend ?? []) as Array<{ cost_usd: number | string }>).reduce((s, r) => s + Number(r.cost_usd), 0);

  return { companies: done, rows, budgetReached, outOfTime, costUsd: Math.round(costUsd * 1e6) / 1e6 };
}

