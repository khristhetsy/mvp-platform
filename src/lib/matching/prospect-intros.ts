// Brokered prospect-intro requests (founder → CRM prospect investor).
// Service-role reads/writes with explicit filters; callers authorize first.
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { PROSPECT_ID_PREFIX } from "@/lib/matching/prospect-investors";

export type ProspectIntroStatus = "new" | "contacted" | "dismissed";

export interface ProspectIntroRequest {
  id: string;
  companyId: string;
  companyName: string | null;
  founderName: string | null;
  prospectName: string | null;
  investorRef: string;
  status: ProspectIntroStatus;
  createdAt: string;
}

function loose(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

/** Idempotent per (company, prospect) — re-requesting refreshes nothing new. */
export async function createProspectIntroRequest(input: {
  companyId: string;
  founderId: string;
  investorRef: string;
}): Promise<void> {
  await loose()
    .from("prospect_intro_requests")
    .upsert(
      { company_id: input.companyId, founder_id: input.founderId, investor_ref: input.investorRef },
      { onConflict: "company_id,investor_ref", ignoreDuplicates: true },
    );
}

export async function listProspectIntroRequests(status?: ProspectIntroStatus): Promise<ProspectIntroRequest[]> {
  const admin = loose();
  let q = admin
    .from("prospect_intro_requests")
    .select("id, company_id, founder_id, investor_ref, status, created_at")
    .order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data } = await q;
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  if (rows.length === 0) return [];

  const companyIds = [...new Set(rows.map((r) => String(r.company_id)))];
  const founderIds = [...new Set(rows.map((r) => String(r.founder_id)))];
  const prospectIds = [
    ...new Set(
      rows
        .map((r) => String(r.investor_ref))
        .filter((ref) => ref.startsWith(PROSPECT_ID_PREFIX))
        .map((ref) => ref.slice(PROSPECT_ID_PREFIX.length)),
    ),
  ];

  const [companiesRes, foundersRes, prospectsRes] = await Promise.all([
    admin.from("companies").select("id, company_name").in("id", companyIds),
    admin.from("profiles").select("id, full_name, email").in("id", founderIds),
    prospectIds.length ? admin.from("prospect_investors").select("id, name").in("id", prospectIds) : Promise.resolve({ data: [] }),
  ]);
  const companyName = new Map((companiesRes.data ?? []).map((c: Record<string, unknown>) => [String(c.id), c.company_name as string | null]));
  const founderName = new Map(
    (foundersRes.data ?? []).map((p: Record<string, unknown>) => [String(p.id), (p.full_name as string) || (p.email as string) || null]),
  );
  const prospectName = new Map((prospectsRes.data ?? []).map((p: Record<string, unknown>) => [String(p.id), p.name as string | null]));

  return rows.map((r) => {
    const ref = String(r.investor_ref);
    const pid = ref.startsWith(PROSPECT_ID_PREFIX) ? ref.slice(PROSPECT_ID_PREFIX.length) : null;
    return {
      id: String(r.id),
      companyId: String(r.company_id),
      companyName: companyName.get(String(r.company_id)) ?? null,
      founderName: founderName.get(String(r.founder_id)) ?? null,
      prospectName: pid ? prospectName.get(pid) ?? null : null,
      investorRef: ref,
      status: (r.status as ProspectIntroStatus) ?? "new",
      createdAt: String(r.created_at),
    };
  });
}

export async function setProspectIntroStatus(
  id: string,
  status: ProspectIntroStatus,
  handledBy: string,
): Promise<boolean> {
  const { error } = await loose()
    .from("prospect_intro_requests")
    .update({ status, handled_by: handledBy, handled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);
  return !error;
}
