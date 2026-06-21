// Founder-facing read of an engagement. Uses the founder's RLS session client so
// the visibility gate + membership enforce themselves; selects only safe columns
// (no internal_note / icfo_review — candor layer is admin-only).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

export type FounderView = {
  engagement: {
    id: string;
    company_name: string;
    report_code: string;
    lifecycle_stage: string;
    round_label: string | null;
    sector: string | null;
  };
  findings: Array<{
    id: string; finding_code: string; domain_id: string | null; title: string;
    detail: string | null; severity: string; status: string; verification: string;
  }>;
  domains: Array<{ id: string; code: string; name: string; overview: string | null }>;
  docRequests: Array<{ id: string; category: string; label: string; closes_findings: string[]; due_date: string | null; status: string; document_id: string | null }>;
  responses: Array<{ id: string; finding_codes: string[]; body: string; disposition: string; due_date: string | null; submitted_at: string | null; locked: boolean }>;
  documents: Array<{ id: string; filename: string; uploaded_at: string }>;
};

/** Load the gated founder view via the user's RLS client. Returns null if the
 *  founder has no access (not a member, or the engagement doesn't exist). */
export async function loadFounderView(userClient: SupabaseClient<Database>, eid: string): Promise<FounderView | null> {
  const db = raw(userClient);
  const { data: engagement } = await db
    .from("dd_engagements")
    .select("id, company_name, report_code, lifecycle_stage, round_label, sector")
    .eq("id", eid)
    .maybeSingle();
  if (!engagement) return null;

  const [{ data: findings }, { data: domains }, { data: docRequests }, { data: responses }, { data: documents }] = await Promise.all([
    db.from("dd_findings").select("id, finding_code, domain_id, title, detail, severity, status, verification").eq("engagement_id", eid).order("finding_code"),
    db.from("dd_domains").select("id, code, name, overview").eq("engagement_id", eid).order("sort_order"),
    db.from("dd_doc_requests").select("id, category, label, closes_findings, due_date, status, document_id").eq("engagement_id", eid),
    db.from("dd_responses").select("id, finding_codes, body, disposition, due_date, submitted_at, locked").eq("engagement_id", eid).order("submitted_at"),
    db.from("dd_documents").select("id, filename, uploaded_at").eq("engagement_id", eid).order("uploaded_at", { ascending: false }),
  ]);

  return {
    engagement: engagement as FounderView["engagement"],
    findings: (findings ?? []) as FounderView["findings"],
    domains: (domains ?? []) as FounderView["domains"],
    docRequests: (docRequests ?? []) as FounderView["docRequests"],
    responses: (responses ?? []) as FounderView["responses"],
    documents: (documents ?? []) as FounderView["documents"],
  };
}
