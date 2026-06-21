// Investor cut: the released, gated package. Service-role read + explicit
// membership/released assertion, then the role='investor' serializer filters it.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { serializeReport, type ReportPayload } from "./serialize";

function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

export type InvestorDeal = { id: string; company_name: string; report_code: string; sector: string | null; round_label: string | null; updated_at: string };

/** Released engagements this investor is a member of, newest first. */
export async function listInvestorDeals(service: SupabaseClient<Database>, userId: string): Promise<InvestorDeal[]> {
  const { data: members } = await raw(service).from("dd_engagement_members").select("engagement_id").eq("user_id", userId).eq("role", "investor");
  const ids = ((members ?? []) as Array<{ engagement_id: string }>).map((m) => m.engagement_id);
  if (ids.length === 0) return [];
  const { data } = await raw(service)
    .from("dd_engagements")
    .select("id, company_name, report_code, sector, round_label, updated_at")
    .in("id", ids)
    .eq("lifecycle_stage", "released")
    .order("updated_at", { ascending: false });
  return (data as unknown as InvestorDeal[]) ?? [];
}

export async function isInvestorMember(service: SupabaseClient<Database>, eid: string, userId: string): Promise<boolean> {
  const { data } = await raw(service).from("dd_engagement_members").select("role").eq("engagement_id", eid).eq("user_id", userId).eq("role", "investor").maybeSingle();
  return Boolean(data);
}

/** Returns the gated investor payload, or null if not permitted (not a member,
 *  or the engagement isn't released). */
export async function loadInvestorCut(service: SupabaseClient<Database>, eid: string, userId: string): Promise<ReportPayload | null> {
  if (!(await isInvestorMember(service, eid, userId))) return null;
  const { data: eng } = await raw(service).from("dd_engagements").select("lifecycle_stage").eq("id", eid).maybeSingle();
  if ((eng as { lifecycle_stage?: string } | null)?.lifecycle_stage !== "released") return null;
  return serializeReport(service, eid, "investor");
}

/** Add a member (founder/investor) by email — admin only. */
export async function addMember(
  service: SupabaseClient<Database>,
  eid: string,
  email: string,
  role: "founder" | "investor",
): Promise<{ email: string }> {
  const { data: prof } = await raw(service).from("profiles").select("id, email, role").ilike("email", email.trim()).maybeSingle();
  const p = prof as { id: string; email: string; role: string } | null;
  if (!p) throw new Error("No account found for that email.");
  if (String(p.role).toLowerCase() !== role) throw new Error(`That account is not ${role === "investor" ? "an investor" : "a founder"}.`);
  await raw(service).from("dd_engagement_members").upsert({ engagement_id: eid, user_id: p.id, role }, { onConflict: "engagement_id,user_id" });
  return { email: p.email };
}

export async function listMembers(service: SupabaseClient<Database>, eid: string): Promise<Array<{ email: string; role: string }>> {
  const { data: members } = await raw(service).from("dd_engagement_members").select("user_id, role").eq("engagement_id", eid);
  const rows = (members ?? []) as Array<{ user_id: string; role: string }>;
  if (rows.length === 0) return [];
  const { data: profs } = await raw(service).from("profiles").select("id, email").in("id", rows.map((r) => r.user_id));
  const emailById = new Map(((profs ?? []) as Array<{ id: string; email: string }>).map((p) => [p.id, p.email]));
  return rows.map((r) => ({ email: emailById.get(r.user_id) ?? r.user_id, role: r.role }));
}
