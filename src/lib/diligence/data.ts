// DD data access (admin). Service-role client; RLS is the enforcement layer for
// founder/investor reads elsewhere.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { Claim, Domain, Engagement, Finding, Severity, Verification } from "./types";
import { nextFindingCode, generateReportCode, companySlug } from "./codes";
import { computeConfidence } from "./confidence";
import { ddAudit } from "./audit";

function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

export async function listEngagements(supabase: SupabaseClient<Database>): Promise<Engagement[]> {
  const { data } = await raw(supabase).from("dd_engagements").select("*").order("created_at", { ascending: false });
  return (data as unknown as Engagement[]) ?? [];
}

export async function getEngagement(supabase: SupabaseClient<Database>, id: string): Promise<Engagement | null> {
  const { data } = await raw(supabase).from("dd_engagements").select("*").eq("id", id).maybeSingle();
  return (data as unknown as Engagement) ?? null;
}

export type EngagementDetail = {
  engagement: Engagement;
  domains: Domain[];
  findings: Finding[];
  claims: Claim[];
  docRequests: unknown[];
  conditions: unknown[];
  documents: unknown[];
};

export async function loadEngagementDetail(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<EngagementDetail | null> {
  const engagement = await getEngagement(supabase, id);
  if (!engagement) return null;
  const [{ data: domains }, { data: findings }, { data: claims }, { data: docRequests }, { data: conditions }, { data: documents }] = await Promise.all([
    raw(supabase).from("dd_domains").select("*").eq("engagement_id", id).order("sort_order", { ascending: true }),
    raw(supabase).from("dd_findings").select("*").eq("engagement_id", id).order("finding_code", { ascending: true }),
    raw(supabase).from("dd_claims").select("*").eq("engagement_id", id).order("id", { ascending: true }),
    raw(supabase).from("dd_doc_requests").select("*").eq("engagement_id", id).order("category", { ascending: true }),
    raw(supabase).from("dd_conditions").select("*").eq("engagement_id", id).order("sort_order", { ascending: true }),
    raw(supabase).from("dd_documents").select("id, filename, uploaded_at").eq("engagement_id", id).order("uploaded_at", { ascending: false }),
  ]);
  return {
    engagement,
    domains: (domains as unknown as Domain[]) ?? [],
    findings: (findings as unknown as Finding[]) ?? [],
    claims: (claims as unknown as Claim[]) ?? [],
    docRequests: (docRequests as unknown[]) ?? [],
    conditions: (conditions as unknown[]) ?? [],
    documents: (documents as unknown[]) ?? [],
  };
}

export async function createEngagement(
  supabase: SupabaseClient<Database>,
  input: { companyName: string; roundLabel?: string | null; sector?: string | null; ownerId: string; companyId?: string | null },
): Promise<Engagement> {
  const { data, error } = await raw(supabase)
    .from("dd_engagements")
    .insert({
      company_name: input.companyName,
      company_slug: companySlug(input.companyName),
      round_label: input.roundLabel ?? null,
      sector: input.sector ?? null,
      report_code: generateReportCode(input.companyName),
      owner_id: input.ownerId,
      company_id: input.companyId ?? null,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(`Could not create engagement: ${error?.message ?? "unknown"}`);

  const engagement = data as unknown as Engagement;
  // Seed 5 domains + default gate rows.
  await raw(supabase).rpc("dd_seed_engagement", { eid: engagement.id });
  await ddAudit(supabase, { engagementId: engagement.id, actorId: input.ownerId, action: "engagement.create", target: engagement.id, after: { company_name: input.companyName } });
  return engagement;
}

export async function upsertFinding(
  supabase: SupabaseClient<Database>,
  engagementId: string,
  actorId: string,
  f: Partial<Finding> & { title?: string; severity?: Severity },
): Promise<Finding> {
  if (f.id) {
    const patch: Record<string, unknown> = {};
    for (const k of ["domain_id", "title", "detail", "severity", "status", "verification", "source", "internal_note"] as const) {
      if (f[k] !== undefined) patch[k] = f[k];
    }
    const { data, error } = await raw(supabase).from("dd_findings").update(patch).eq("id", f.id).eq("engagement_id", engagementId).select("*").single();
    if (error || !data) throw new Error(`Could not update finding: ${error?.message ?? "unknown"}`);
    await ddAudit(supabase, { engagementId, actorId, action: "finding.update", target: f.id, after: patch });
    return data as unknown as Finding;
  }

  const { data: existing } = await raw(supabase).from("dd_findings").select("finding_code").eq("engagement_id", engagementId);
  const code = nextFindingCode(((existing ?? []) as Array<{ finding_code: string }>).map((r) => r.finding_code));
  const { data, error } = await raw(supabase)
    .from("dd_findings")
    .insert({
      engagement_id: engagementId,
      finding_code: code,
      domain_id: f.domain_id ?? null,
      title: f.title ?? "Untitled finding",
      detail: f.detail ?? null,
      severity: f.severity ?? "medium",
      status: f.status ?? "open",
      verification: f.verification ?? "unverified",
      source: f.source ?? null,
      internal_note: f.internal_note ?? null,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(`Could not create finding: ${error?.message ?? "unknown"}`);
  await ddAudit(supabase, { engagementId, actorId, action: "finding.create", target: code });
  return data as unknown as Finding;
}

export async function deleteFinding(supabase: SupabaseClient<Database>, engagementId: string, actorId: string, findingId: string): Promise<void> {
  const { error } = await raw(supabase).from("dd_findings").delete().eq("id", findingId).eq("engagement_id", engagementId);
  if (error) throw new Error(`Could not delete finding: ${error.message}`);
  await ddAudit(supabase, { engagementId, actorId, action: "finding.delete", target: findingId });
}

export async function upsertClaim(
  supabase: SupabaseClient<Database>,
  engagementId: string,
  actorId: string,
  c: Partial<Claim> & { claim?: string },
): Promise<Claim> {
  if (c.id) {
    const patch: Record<string, unknown> = {};
    for (const k of ["claim", "claimed_value", "source_asserted", "verification", "finding_id", "weight"] as const) {
      if (c[k] !== undefined) patch[k] = c[k];
    }
    const { data, error } = await raw(supabase).from("dd_claims").update(patch).eq("id", c.id).eq("engagement_id", engagementId).select("*").single();
    if (error || !data) throw new Error(`Could not update claim: ${error?.message ?? "unknown"}`);
    await ddAudit(supabase, { engagementId, actorId, action: "claim.update", target: c.id, after: patch });
    return data as unknown as Claim;
  }
  const { data, error } = await raw(supabase)
    .from("dd_claims")
    .insert({
      engagement_id: engagementId,
      claim: c.claim ?? "Untitled claim",
      claimed_value: c.claimed_value ?? null,
      source_asserted: c.source_asserted ?? null,
      verification: c.verification ?? "unverified",
      finding_id: c.finding_id ?? null,
      weight: c.weight ?? 1,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(`Could not create claim: ${error?.message ?? "unknown"}`);
  await ddAudit(supabase, { engagementId, actorId, action: "claim.create", target: (data as { id: string }).id });
  return data as unknown as Claim;
}

/** Verify a claim, advance its linked finding when verified, recompute confidence. */
export async function verifyClaim(
  supabase: SupabaseClient<Database>,
  engagementId: string,
  actorId: string,
  claimId: string,
  state: Verification,
): Promise<{ confidence: number }> {
  const { data: claim, error } = await raw(supabase)
    .from("dd_claims")
    .update({ verification: state })
    .eq("id", claimId)
    .eq("engagement_id", engagementId)
    .select("*")
    .single();
  if (error || !claim) throw new Error(`Could not verify claim: ${error?.message ?? "unknown"}`);

  const c = claim as unknown as Claim;
  if (c.finding_id && state === "verified") {
    await raw(supabase).from("dd_findings").update({ verification: "verified" }).eq("id", c.finding_id);
  } else if (c.finding_id && state === "discrepancy") {
    await raw(supabase).from("dd_findings").update({ verification: "discrepancy" }).eq("id", c.finding_id);
  }

  const confidence = await computeConfidence(supabase, engagementId);
  await raw(supabase).from("dd_engagements").update({ confidence_pct: confidence, updated_at: new Date().toISOString() }).eq("id", engagementId);
  await ddAudit(supabase, { engagementId, actorId, action: "claim.verify", target: claimId, after: { verification: state, confidence } });
  return { confidence };
}
