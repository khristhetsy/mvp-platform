// Founder mutations (responses + uploads). Service-role client + an explicit
// membership assertion (the founder must be a 'founder' member of the engagement).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { Disposition } from "./types";
import { ddAudit } from "./audit";
import { computeConfidence } from "./confidence";
import { sendNewResponseToAdmin, sendDocumentSubmittedToAdmin } from "./email";

function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

/** Engagement owner's email + company name, for admin notifications. */
async function ownerContact(service: SupabaseClient<Database>, eid: string): Promise<{ email: string; company: string } | null> {
  const { data: eng } = await raw(service).from("dd_engagements").select("owner_id, company_name").eq("id", eid).maybeSingle();
  const e = eng as { owner_id?: string; company_name?: string } | null;
  if (!e?.owner_id) return null;
  const { data: o } = await raw(service).from("profiles").select("email").eq("id", e.owner_id).maybeSingle();
  const email = (o as { email?: string } | null)?.email;
  return email ? { email, company: e.company_name ?? "the engagement" } : null;
}

export class NotAMemberError extends Error {
  constructor() {
    super("You don't have access to this engagement.");
    this.name = "NotAMemberError";
  }
}

export async function assertFounderMember(service: SupabaseClient<Database>, eid: string, userId: string): Promise<void> {
  const { data } = await raw(service)
    .from("dd_engagement_members")
    .select("role")
    .eq("engagement_id", eid)
    .eq("user_id", userId)
    .eq("role", "founder")
    .maybeSingle();
  if (!data) throw new NotAMemberError();
}

export async function submitFounderResponse(
  service: SupabaseClient<Database>,
  eid: string,
  userId: string,
  input: {
    finding_codes: string[];
    body: string;
    disposition: Disposition;
    owner_role?: string | null;
    due_date?: string | null;
    evidence_doc_id?: string | null;
  },
): Promise<{ id: string }> {
  await assertFounderMember(service, eid, userId);

  const { data, error } = await raw(service)
    .from("dd_responses")
    .insert({
      engagement_id: eid,
      finding_codes: input.finding_codes,
      body: input.body,
      disposition: input.disposition,
      owner_role: input.owner_role ?? "founder",
      due_date: input.due_date ?? null,
      evidence_doc_id: input.evidence_doc_id ?? null,
      submitted_by: userId,
      submitted_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Could not submit response: ${error?.message ?? "unknown"}`);

  // First response advances the engagement: sent_to_founder → responding.
  const { data: eng } = await raw(service).from("dd_engagements").select("lifecycle_stage").eq("id", eid).maybeSingle();
  if ((eng as { lifecycle_stage?: string } | null)?.lifecycle_stage === "sent_to_founder") {
    await raw(service).from("dd_engagements").update({ lifecycle_stage: "responding", updated_at: new Date().toISOString() }).eq("id", eid);
    await ddAudit(service, { engagementId: eid, actorId: userId, action: "stage.founder_responded", target: eid, after: { to: "responding" } });
  }

  await ddAudit(service, { engagementId: eid, actorId: userId, action: "response.submit", target: (data as { id: string }).id, after: { finding_codes: input.finding_codes, disposition: input.disposition } });

  const owner = await ownerContact(service, eid);
  if (owner) { try { await sendNewResponseToAdmin(owner.email, owner.company, eid); } catch { /* best-effort */ } }

  return data as { id: string };
}

export async function uploadFounderDocument(
  service: SupabaseClient<Database>,
  eid: string,
  userId: string,
  file: { bytes: Buffer; filename: string; contentType: string },
  opts: { docRequestId?: string | null; responseId?: string | null } = {},
): Promise<{ documentId: string }> {
  await assertFounderMember(service, eid, userId);

  const path = `${eid}/${crypto.randomUUID()}-${file.filename.replace(/[^\w.\-]+/g, "_")}`;
  const up = await service.storage.from("dd-documents").upload(path, file.bytes, { contentType: file.contentType, upsert: false });
  if (up.error) throw new Error(`Upload failed: ${up.error.message}`);

  const { data: doc, error } = await raw(service)
    .from("dd_documents")
    .insert({ engagement_id: eid, storage_path: path, filename: file.filename, uploaded_by: userId })
    .select("id")
    .single();
  if (error || !doc) throw new Error(`Could not record document: ${error?.message ?? "unknown"}`);
  const documentId = (doc as { id: string }).id;

  if (opts.docRequestId) {
    const { data: dr } = await raw(service)
      .from("dd_doc_requests")
      .update({ status: "submitted", document_id: documentId })
      .eq("id", opts.docRequestId)
      .eq("engagement_id", eid)
      .select("closes_findings")
      .single();
    // Advance findings this request closes to 'submitted'.
    const codes = ((dr as { closes_findings?: string[] } | null)?.closes_findings ?? []);
    if (codes.length) {
      await raw(service).from("dd_findings").update({ verification: "submitted" }).eq("engagement_id", eid).in("finding_code", codes).neq("verification", "verified");
    }
  }

  if (opts.responseId) {
    await raw(service).from("dd_responses").update({ evidence_doc_id: documentId }).eq("id", opts.responseId).eq("engagement_id", eid);
  }

  // Recompute confidence (verified claims only — submit won't raise it, but keeps it fresh).
  const confidence = await computeConfidence(service, eid);
  await raw(service).from("dd_engagements").update({ confidence_pct: confidence }).eq("id", eid);

  await ddAudit(service, { engagementId: eid, actorId: userId, action: "document.upload", target: documentId, after: { filename: file.filename, doc_request: opts.docRequestId ?? null } });

  const owner = await ownerContact(service, eid);
  if (owner) { try { await sendDocumentSubmittedToAdmin(owner.email, owner.company, eid); } catch { /* best-effort */ } }

  return { documentId };
}
