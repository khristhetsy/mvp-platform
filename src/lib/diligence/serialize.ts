// Role-aware report serializer (§10). Admin gets everything; founder/investor
// get a gated, candor-stripped cut. Service-role read, then filter in memory —
// this is the canonical filter used by the PDF export and investor cut.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { DiligenceRole, GateSection } from "./types";
import { loadGate } from "./gate";

function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

export type ReportPayload = {
  engagement: Record<string, unknown>;
  domains: Record<string, unknown>[];
  findings: Record<string, unknown>[];
  claims?: Record<string, unknown>[];
  responses: Record<string, unknown>[];
  docRequests: Record<string, unknown>[];
  conditions: Record<string, unknown>[];
  confidence: number;
};

async function loadFullReport(supabase: SupabaseClient<Database>, eid: string): Promise<ReportPayload | null> {
  const db = raw(supabase);
  const { data: engagement } = await db.from("dd_engagements").select("*").eq("id", eid).maybeSingle();
  if (!engagement) return null;
  const [{ data: domains }, { data: findings }, { data: claims }, { data: responses }, { data: docRequests }, { data: conditions }] = await Promise.all([
    db.from("dd_domains").select("*").eq("engagement_id", eid).order("sort_order"),
    db.from("dd_findings").select("*").eq("engagement_id", eid).order("finding_code"),
    db.from("dd_claims").select("*").eq("engagement_id", eid),
    db.from("dd_responses").select("*").eq("engagement_id", eid).order("submitted_at"),
    db.from("dd_doc_requests").select("*").eq("engagement_id", eid),
    db.from("dd_conditions").select("*").eq("engagement_id", eid).order("sort_order"),
  ]);
  return {
    engagement: engagement as Record<string, unknown>,
    domains: (domains ?? []) as Record<string, unknown>[],
    findings: (findings ?? []) as Record<string, unknown>[],
    claims: (claims ?? []) as Record<string, unknown>[],
    responses: (responses ?? []) as Record<string, unknown>[],
    docRequests: (docRequests ?? []) as Record<string, unknown>[],
    conditions: (conditions ?? []) as Record<string, unknown>[],
    confidence: (engagement as { confidence_pct?: number }).confidence_pct ?? 0,
  };
}

const stripCandor = (f: Record<string, unknown>) => { const { internal_note: _drop, ...rest } = f; void _drop; return rest; };
const stripReview = (r: Record<string, unknown>) => { const { icfo_review: _drop, ...rest } = r; void _drop; return rest; };

/** Role-aware serialized report. Returns null if the engagement doesn't exist. */
export async function serializeReport(
  supabase: SupabaseClient<Database>,
  eid: string,
  role: DiligenceRole,
): Promise<ReportPayload | null> {
  const raw_ = await loadFullReport(supabase, eid);
  if (!raw_) return null;
  if (role === "admin") return raw_;

  const gate = await loadGate(supabase, eid);
  const show = (s: GateSection) => (role === "founder" ? gate[s]?.founder_visible : gate[s]?.investor_visible) ?? false;
  const eng = raw_.engagement as Record<string, unknown>;

  return {
    ...raw_,
    claims: undefined, // never to non-admin
    findings: show("findings") ? raw_.findings.map(stripCandor) : [],
    responses: show("responses") ? raw_.responses.map(stripReview) : [],
    docRequests: show("data_room") ? raw_.docRequests : [],
    conditions: show("findings") ? raw_.conditions : [],
    engagement: {
      ...eng,
      posture: show("verdict") ? eng.posture : null,
      recommendation: show("verdict") ? eng.recommendation : null,
      // never leak the candor-adjacent internal fields
      owner_id: undefined,
    },
  };
}
