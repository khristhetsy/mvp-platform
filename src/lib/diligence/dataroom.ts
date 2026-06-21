// Data-room requests + conditions (§9). Service role; admin-driven.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { computeConfidence } from "./confidence";
import { ddAudit } from "./audit";

function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

export type DocRequest = {
  id: string; category: string; label: string; closes_findings: string[];
  owner_role: string | null; due_date: string | null; status: string; document_id: string | null;
};
export type Condition = { id: string; label: string; detail: string | null; status: string; sort_order: number | null };

// ── Doc requests ─────────────────────────────────────────────────────────────
export async function listDocRequests(supabase: SupabaseClient<Database>, eid: string): Promise<DocRequest[]> {
  const { data } = await raw(supabase).from("dd_doc_requests").select("*").eq("engagement_id", eid).order("category");
  return (data as unknown as DocRequest[]) ?? [];
}

export async function createDocRequest(
  supabase: SupabaseClient<Database>,
  eid: string,
  actorId: string,
  input: { category: string; label: string; closes_findings?: string[]; owner_role?: string | null; due_date?: string | null },
): Promise<DocRequest> {
  const { data, error } = await raw(supabase)
    .from("dd_doc_requests")
    .insert({
      engagement_id: eid,
      category: input.category,
      label: input.label,
      closes_findings: input.closes_findings ?? [],
      owner_role: input.owner_role ?? "founder",
      due_date: input.due_date ?? null,
      status: "requested",
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(`Could not create request: ${error?.message ?? "unknown"}`);
  await ddAudit(supabase, { engagementId: eid, actorId, action: "doc_request.create", target: (data as { id: string }).id, after: { label: input.label } });
  return data as unknown as DocRequest;
}

/** Auto-build requests from open/unverified findings not already covered. */
export async function generateDocRequests(supabase: SupabaseClient<Database>, eid: string, actorId: string): Promise<{ count: number }> {
  const db = raw(supabase);
  const [{ data: findings }, { data: existing }] = await Promise.all([
    db.from("dd_findings").select("finding_code, title, status, verification").eq("engagement_id", eid),
    db.from("dd_doc_requests").select("closes_findings").eq("engagement_id", eid),
  ]);

  const covered = new Set<string>();
  for (const r of (existing ?? []) as Array<{ closes_findings: string[] }>) for (const c of r.closes_findings ?? []) covered.add(c);

  const targets = ((findings ?? []) as Array<{ finding_code: string; title: string; status: string; verification: string }>)
    .filter((f) => !covered.has(f.finding_code) && (f.status === "open" || ["unverified", "requested"].includes(f.verification)));

  if (targets.length === 0) return { count: 0 };

  await db.from("dd_doc_requests").insert(
    targets.map((f) => ({
      engagement_id: eid,
      category: "Evidence",
      label: `Evidence for ${f.finding_code}: ${f.title}`.slice(0, 200),
      closes_findings: [f.finding_code],
      owner_role: "founder",
      status: "requested",
    })),
  );
  // Mark those findings as 'requested' (verification) where still unverified.
  await db.from("dd_findings").update({ verification: "requested" }).eq("engagement_id", eid).in("finding_code", targets.map((t) => t.finding_code)).eq("verification", "unverified");

  await ddAudit(supabase, { engagementId: eid, actorId, action: "doc_request.generate", target: eid, after: { count: targets.length } });
  return { count: targets.length };
}

/** Admin verifies a submitted request: advance its findings + their claims to verified. */
export async function verifyDocRequest(supabase: SupabaseClient<Database>, eid: string, actorId: string, requestId: string): Promise<{ confidence: number }> {
  const db = raw(supabase);
  const { data: dr, error } = await db.from("dd_doc_requests").update({ status: "verified" }).eq("id", requestId).eq("engagement_id", eid).select("closes_findings").single();
  if (error || !dr) throw new Error(`Could not verify request: ${error?.message ?? "unknown"}`);

  const codes = ((dr as { closes_findings?: string[] }).closes_findings ?? []);
  if (codes.length) {
    const { data: fids } = await db.from("dd_findings").update({ verification: "verified" }).eq("engagement_id", eid).in("finding_code", codes).select("id");
    const ids = ((fids ?? []) as Array<{ id: string }>).map((r) => r.id);
    if (ids.length) await db.from("dd_claims").update({ verification: "verified" }).eq("engagement_id", eid).in("finding_id", ids);
  }

  const confidence = await computeConfidence(supabase, eid);
  await db.from("dd_engagements").update({ confidence_pct: confidence, updated_at: new Date().toISOString() }).eq("id", eid);
  await ddAudit(supabase, { engagementId: eid, actorId, action: "doc_request.verify", target: requestId, after: { confidence } });
  return { confidence };
}

// ── Conditions ───────────────────────────────────────────────────────────────
export async function listConditions(supabase: SupabaseClient<Database>, eid: string): Promise<Condition[]> {
  const { data } = await raw(supabase).from("dd_conditions").select("*").eq("engagement_id", eid).order("sort_order");
  return (data as unknown as Condition[]) ?? [];
}

export async function upsertCondition(
  supabase: SupabaseClient<Database>,
  eid: string,
  actorId: string,
  c: { id?: string; label?: string; detail?: string | null; status?: string; sort_order?: number | null },
): Promise<Condition> {
  if (c.id) {
    const patch: Record<string, unknown> = {};
    for (const k of ["label", "detail", "status", "sort_order"] as const) if (c[k] !== undefined) patch[k] = c[k];
    const { data, error } = await raw(supabase).from("dd_conditions").update(patch).eq("id", c.id).eq("engagement_id", eid).select("*").single();
    if (error || !data) throw new Error(`Could not update condition: ${error?.message ?? "unknown"}`);
    await ddAudit(supabase, { engagementId: eid, actorId, action: "condition.update", target: c.id, after: patch });
    return data as unknown as Condition;
  }
  const { data, error } = await raw(supabase).from("dd_conditions").insert({ engagement_id: eid, label: c.label ?? "Condition", detail: c.detail ?? null, status: c.status ?? "not_started", sort_order: c.sort_order ?? null }).select("*").single();
  if (error || !data) throw new Error(`Could not create condition: ${error?.message ?? "unknown"}`);
  await ddAudit(supabase, { engagementId: eid, actorId, action: "condition.create", target: (data as { id: string }).id });
  return data as unknown as Condition;
}

export async function deleteCondition(supabase: SupabaseClient<Database>, eid: string, actorId: string, conditionId: string): Promise<void> {
  const { error } = await raw(supabase).from("dd_conditions").delete().eq("id", conditionId).eq("engagement_id", eid);
  if (error) throw new Error(`Could not delete condition: ${error.message}`);
  await ddAudit(supabase, { engagementId: eid, actorId, action: "condition.delete", target: conditionId });
}
