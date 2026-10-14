/**
 * Companies list → founders to email. The Companies page selects companies; the
 * email goes to each company's founder. Demo (sample) companies and internal
 * accounts never receive real email, and founders without an address are counted
 * and skipped. Server only (service role).
 */

import { createServiceRoleClient } from "@/lib/supabase/admin";

export type CompanyRecipient = {
  companyId: string;
  companyName: string;
  profileId: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
};

export type CompanyRecipients = {
  recipients: CompanyRecipient[];
  skippedNoEmail: number;
  /** Demo companies and internal accounts. */
  skippedInternal: number;
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const CHUNK = 200;

function chunks<T>(xs: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

function splitName(name: string | null): { first: string | null; last: string | null } {
  const n = (name ?? "").trim();
  if (!n) return { first: null, last: null };
  const i = n.indexOf(" ");
  return i === -1 ? { first: n, last: null } : { first: n.slice(0, i), last: n.slice(i + 1) };
}

export async function resolveCompanyRecipients(companyIds: string[]): Promise<CompanyRecipients> {
  const ids = [...new Set(companyIds)];
  const admin = createServiceRoleClient();

  const companies: Array<{ id: string; company_name: string | null; founder_id: string | null; is_sample: boolean | null }> = [];
  for (const part of chunks(ids, CHUNK)) {
    const { data } = await admin.from("companies").select("id, company_name, founder_id, is_sample").in("id", part);
    companies.push(...((data ?? []) as typeof companies));
  }

  const founderIds = [...new Set(companies.map((c) => c.founder_id).filter((x): x is string => !!x))];
  const profiles = new Map<string, { full_name: string | null; email: string | null }>();
  const plans = new Map<string, string>();
  for (const part of chunks(founderIds, CHUNK)) {
    const [{ data: profs }, { data: subs }] = await Promise.all([
      admin.from("profiles").select("id, full_name, email").in("id", part),
      admin.from("subscriptions").select("profile_id, plan_type").in("profile_id", part),
    ]);
    for (const p of (profs ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) profiles.set(p.id, p);
    for (const s of (subs ?? []) as Array<{ profile_id: string; plan_type: string | null }>) if (s.plan_type) plans.set(s.profile_id, s.plan_type);
  }

  const recipients: CompanyRecipient[] = [];
  const seen = new Set<string>();
  let skippedNoEmail = 0;
  let skippedInternal = 0;
  for (const c of companies) {
    if (c.is_sample || (c.founder_id && plans.get(c.founder_id) === "admin_internal")) { skippedInternal++; continue; }
    const p = c.founder_id ? profiles.get(c.founder_id) : undefined;
    const email = (p?.email ?? "").trim().toLowerCase();
    if (!c.founder_id || !EMAIL_RE.test(email)) { skippedNoEmail++; continue; }
    if (seen.has(email)) continue;
    seen.add(email);
    const { first, last } = splitName(p?.full_name ?? null);
    recipients.push({ companyId: c.id, companyName: (c.company_name ?? "").trim(), profileId: c.founder_id, email, first_name: first, last_name: last });
  }
  return { recipients, skippedNoEmail, skippedInternal };
}
