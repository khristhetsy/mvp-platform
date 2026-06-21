// Consent + version sealing (§13, adapted to the in-house e-signature module).
// requestConsent freezes a report version, renders its PDF, and opens a single
// signer (founder) e-sign envelope. When that envelope completes, the e-sign
// submit route calls onSignatureCompleted(), which seals the version + advances
// the engagement to consented_locked.

import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { serializeReport } from "./serialize";
import { renderDiligenceMemoPdf } from "./pdf";
import { evaluateTransition } from "./state-machine";
import { ddAudit } from "./audit";
import { ActionError } from "./admin-actions";
import { sendFounderSigned } from "./email";
import { uploadToSignatureBucket } from "@/lib/esignature/storage";
import { countPdfPages } from "@/lib/esignature/pdf";
import { createDraftRequest, updateRequestDetails, markRequestSent } from "@/lib/esignature/requests";
import { replaceFields } from "@/lib/esignature/fields";
import { sendSigningInvite, buildSignUrl } from "@/lib/esignature/email";
import { STORAGE_FOLDER_ORIGINALS } from "@/lib/esignature/types";

function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

/** Snapshot the admin report into a draft version row. */
async function freezeVersion(supabase: SupabaseClient<Database>, eid: string): Promise<{ id: string; version: string }> {
  const snapshot = await serializeReport(supabase, eid, "admin");
  if (!snapshot) throw new ActionError("Engagement not found.");
  const { data: existing } = await raw(supabase).from("dd_report_versions").select("id").eq("engagement_id", eid);
  const version = `v${((existing ?? []) as unknown[]).length + 1}`;
  const { data, error } = await raw(supabase)
    .from("dd_report_versions")
    .insert({ engagement_id: eid, version, snapshot, status: "draft" })
    .select("id, version")
    .single();
  if (error || !data) throw new ActionError(`Could not freeze version: ${error?.message ?? "unknown"}`);
  return data as { id: string; version: string };
}

export async function requestConsent(
  supabase: SupabaseClient<Database>,
  eid: string,
  actorId: string,
  signer: { name: string; email: string },
): Promise<{ envelopeId: string; signUrl: string; delivered: boolean }> {
  const { data: engRow } = await raw(supabase).from("dd_engagements").select("company_name, lifecycle_stage, sector").eq("id", eid).maybeSingle();
  const eng = engRow as { company_name?: string; lifecycle_stage?: string; sector?: string } | null;
  if (!eng) throw new ActionError("Engagement not found.");

  const t = evaluateTransition((eng.lifecycle_stage ?? "draft") as never, "request_consent", "admin");
  if (!t.ok) throw new ActionError(t.error);

  // Freeze + render the snapshot PDF.
  const version = await freezeVersion(supabase, eid);
  const snapshot = await serializeReport(supabase, eid, "admin");
  const pdf = await renderDiligenceMemoPdf(snapshot!, "admin");
  const pageCount = await countPdfPages(pdf);

  // Stage the PDF in the e-signature bucket + create the envelope.
  const sigRequestId = crypto.randomUUID();
  const workingPath = `${STORAGE_FOLDER_ORIGINALS}/${sigRequestId}.pdf`;
  await uploadToSignatureBucket(supabase, workingPath, pdf, "application/pdf");

  const docName = `iCFO Consent — ${eng.company_name ?? "Engagement"}`;
  const sigReq = await createDraftRequest(supabase, {
    documentName: docName,
    dealLabel: eng.company_name ?? null,
    sourceFormat: "pdf",
    workingFilePath: workingPath,
    pageCount,
    createdBy: actorId,
  });

  // Signature + date on the last page.
  await replaceFields(supabase, sigReq.id, [
    { field_type: "signature", page: pageCount, x: 0.1, y: 0.86, width: 0.35, height: 0.06, required: true },
    { field_type: "date", page: pageCount, x: 0.55, y: 0.87, width: 0.2, height: 0.05, required: true, auto_source: "signing_date" },
  ]);
  await updateRequestDetails(supabase, sigReq.id, { signerName: signer.name, signerEmail: signer.email, signerCompany: eng.company_name ?? null });

  const token = randomBytes(32).toString("hex");
  await markRequestSent(supabase, sigReq.id, token);

  // DD consent envelope.
  const { data: envRow, error: envErr } = await raw(supabase)
    .from("dd_consent_envelopes")
    .insert({
      engagement_id: eid,
      version_id: version.id,
      provider: "in_house",
      signature_request_id: sigReq.id,
      status: "sent",
      signers: [{ order: 1, role: "founder", name: signer.name, email: signer.email }],
    })
    .select("id")
    .single();
  if (envErr || !envRow) throw new ActionError(`Could not create consent envelope: ${envErr?.message ?? "unknown"}`);

  await raw(supabase).from("dd_engagements").update({ lifecycle_stage: t.to, updated_at: new Date().toISOString() }).eq("id", eid);
  await ddAudit(supabase, { engagementId: eid, actorId, action: "stage.request_consent", target: eid, after: { to: t.to, version: version.version } });

  let delivered = false;
  try {
    const r = await sendSigningInvite({ to: signer.email, signerName: signer.name, documentName: docName, dealLabel: eng.company_name ?? null, token });
    delivered = r.delivered;
  } catch { /* best-effort */ }

  return { envelopeId: (envRow as { id: string }).id, signUrl: buildSignUrl(token), delivered };
}

/** Called by the e-signature submit route after sealing. Seals the DD version +
 *  advances the engagement. Idempotent + safe to call for non-consent envelopes. */
export async function onSignatureCompleted(supabase: SupabaseClient<Database>, signatureRequestId: string): Promise<void> {
  const { data: envRow } = await raw(supabase).from("dd_consent_envelopes").select("id, engagement_id, version_id, status").eq("signature_request_id", signatureRequestId).maybeSingle();
  const env = envRow as { id: string; engagement_id: string; version_id: string | null; status: string } | null;
  if (!env || env.status === "completed") return;

  const { data: sig } = await raw(supabase).from("signature_requests").select("document_hash, signed_file_path").eq("id", signatureRequestId).maybeSingle();
  const s = sig as { document_hash?: string; signed_file_path?: string } | null;

  if (env.version_id) {
    await raw(supabase).from("dd_report_versions").update({ status: "sealed", document_hash: s?.document_hash ?? null, pdf_path: s?.signed_file_path ?? null }).eq("id", env.version_id);
  }
  await raw(supabase).from("dd_consent_envelopes").update({ status: "completed", certificate_path: s?.signed_file_path ?? null, completed_at: new Date().toISOString() }).eq("id", env.id);

  // Transition consent_requested → consented_locked (system).
  const { data: eng } = await raw(supabase).from("dd_engagements").select("lifecycle_stage, company_name, owner_id").eq("id", env.engagement_id).maybeSingle();
  const e = eng as { lifecycle_stage?: string; company_name?: string; owner_id?: string } | null;
  if (e?.lifecycle_stage === "consent_requested") {
    await raw(supabase).from("dd_engagements").update({ lifecycle_stage: "consented_locked", updated_at: new Date().toISOString() }).eq("id", env.engagement_id);
    await ddAudit(supabase, { engagementId: env.engagement_id, actorId: null, action: "stage.consent_completed", target: env.engagement_id, after: { to: "consented_locked", hash: s?.document_hash ?? null } });

    if (e.owner_id) {
      const { data: owner } = await raw(supabase).from("profiles").select("email").eq("id", e.owner_id).maybeSingle();
      const email = (owner as { email?: string } | null)?.email;
      if (email) { try { await sendFounderSigned(email, e.company_name ?? "the engagement", env.engagement_id); } catch { /* best-effort */ } }
    }
  }
}

/** Lock & release to investors (requires a sealed, consented engagement). */
export async function lockAndRelease(supabase: SupabaseClient<Database>, eid: string, actorId: string): Promise<{ notified: number }> {
  const { data: eng } = await raw(supabase).from("dd_engagements").select("lifecycle_stage, company_name").eq("id", eid).maybeSingle();
  const e = eng as { lifecycle_stage?: string; company_name?: string } | null;
  if (!e) throw new ActionError("Engagement not found.");
  const t = evaluateTransition((e.lifecycle_stage ?? "draft") as never, "release", "admin");
  if (!t.ok) throw new ActionError(t.error);

  const { data: sealed } = await raw(supabase).from("dd_report_versions").select("id").eq("engagement_id", eid).eq("status", "sealed").limit(1);
  if (((sealed ?? []) as unknown[]).length === 0) throw new ActionError("No sealed version — consent must complete first.");

  await raw(supabase).from("dd_engagements").update({ lifecycle_stage: t.to, updated_at: new Date().toISOString() }).eq("id", eid);
  await ddAudit(supabase, { engagementId: eid, actorId, action: "stage.release", target: eid, after: { to: t.to } });

  // Notify investor members.
  const { data: members } = await raw(supabase).from("dd_engagement_members").select("user_id").eq("engagement_id", eid).eq("role", "investor");
  const ids = ((members ?? []) as Array<{ user_id: string }>).map((m) => m.user_id);
  let notified = 0;
  if (ids.length) {
    const { data: profs } = await raw(supabase).from("profiles").select("email").in("id", ids);
    const { sendReleasedToInvestor } = await import("./email");
    for (const p of (profs ?? []) as Array<{ email?: string }>) {
      if (p.email) { try { await sendReleasedToInvestor(p.email, e.company_name ?? "the deal", eid); notified++; } catch { /* best-effort */ } }
    }
  }
  return { notified };
}

/** Compact consent/version status for the admin detail view. */
export async function loadConsentSummary(supabase: SupabaseClient<Database>, eid: string): Promise<{ envelope: { status: string; signature_request_id: string | null } | null; sealedHash: string | null }> {
  const { data: env } = await raw(supabase).from("dd_consent_envelopes").select("status, signature_request_id").eq("engagement_id", eid).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const { data: ver } = await raw(supabase).from("dd_report_versions").select("document_hash").eq("engagement_id", eid).eq("status", "sealed").order("created_at", { ascending: false }).limit(1).maybeSingle();
  return {
    envelope: (env as { status: string; signature_request_id: string | null } | null) ?? null,
    sealedHash: (ver as { document_hash?: string } | null)?.document_hash ?? null,
  };
}
