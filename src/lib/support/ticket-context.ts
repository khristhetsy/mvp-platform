/**
 * Founder context beside a ticket in the support desk: who they are, their
 * plan, stage and investable score, how many requests they've opened before,
 * and the guide for this ticket's topic. Staff only.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { crrScoresFor } from "@/lib/crr/crr-for";
import { PLAN_LABELS, type PlanType } from "@/lib/subscriptions/plans";
import { getSupportGuides, pickGuide, type SupportGuide } from "@/lib/support/guides";
import { supportChannel, type SupportChannel, type SupportRequest } from "@/lib/support/support";

export type TicketContext = {
  founderName: string | null;
  founderEmail: string | null;
  companyId: string;
  companyName: string | null;
  industry: string | null;
  plan: string | null;
  planPrice: string | null;
  stage: string | null;
  investable: number | null;
  pastRequests: number;
  channel: SupportChannel;
  guide: SupportGuide;
};

const STAGE_LABEL: Record<string, string> = { initialize: "Onboarding", qualify: "Preparation", deploy: "Marketing", optimize: "Closing" };

function db(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

export async function loadTicketContext(request: SupportRequest): Promise<TicketContext> {
  const [{ data: prof }, { data: comp }, { data: sub }, { count }, scores, guides] = await Promise.all([
    db().from("profiles").select("full_name, email, journey_stage").eq("id", request.founder_id).maybeSingle(),
    db().from("companies").select("company_name, industry").eq("id", request.company_id).maybeSingle(),
    db().from("subscriptions").select("plan_type, subscription_status, monthly_price_cents").eq("profile_id", request.founder_id).maybeSingle(),
    db().from("support_requests").select("id", { count: "exact", head: true }).eq("founder_id", request.founder_id).neq("id", request.id),
    crrScoresFor([request.company_id]).catch(() => new Map<string, number>()),
    getSupportGuides(),
  ]);
  const p = prof as { full_name: string | null; email: string | null; journey_stage: string | null } | null;
  const c = comp as { company_name: string | null; industry: string | null } | null;
  const s = sub as { plan_type: PlanType; subscription_status: string; monthly_price_cents: number | null } | null;
  const cents = s?.monthly_price_cents ?? null;
  return {
    founderName: p?.full_name ?? null,
    founderEmail: p?.email ?? null,
    companyId: request.company_id,
    companyName: c?.company_name ?? null,
    industry: c?.industry ?? null,
    plan: s ? `${PLAN_LABELS[s.plan_type] ?? s.plan_type}${s.subscription_status === "pending_payment" ? ", payment pending" : ""}` : "No plan",
    planPrice: cents !== null && cents > 0 ? `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}/mo` : null,
    stage: p?.journey_stage ? STAGE_LABEL[p.journey_stage] ?? p.journey_stage : null,
    investable: scores.get(request.company_id) ?? null,
    pastRequests: count ?? 0,
    channel: supportChannel(request),
    guide: pickGuide(guides, request.context_item, request.ai_triage?.topic ?? null),
  };
}
