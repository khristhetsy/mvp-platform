// Call-end writeback: records the attempt (enforcing the two-call cap by
// numbering attempts), logs a unified touch, and writes the outcome back to
// Odoo as a chatter note (non-destructive — Odoo stays the source of record).
// Best-effort on the Odoo side; the Supabase record is authoritative.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { executeKw, odooConfigured } from "@/lib/crm-connectors/odoo/client";

function raw(c: SupabaseClient<Database>): SupabaseClient {
  return c as unknown as SupabaseClient;
}

export interface CallOutcomeInput {
  contactId: string;
  campaignId?: string | null;
  variantId?: string | null;
  disposition: string;         // e.g. booked / no_answer / voicemail / opt_out / not_interested / transferred
  status?: string | null;
  booked?: boolean;
  transferredTo?: string | null;
  duration?: number | null;
  aiDisclosedAt?: string | null;
  transcriptUrl?: string | null;
  recordingUrl?: string | null;
  cost?: number | null;
}

/** Post the outcome as a log note on the Odoo partner's chatter. Best-effort. */
async function writeOdooNote(contactId: string, summary: string): Promise<void> {
  if (!odooConfigured()) return;
  const id = Number(contactId);
  if (!Number.isInteger(id) || id <= 0) return;
  const body = `<p><strong>iCapOS Voice</strong> — ${summary}</p>`;
  await executeKw("res.partner", "message_post", [[id]], {
    body,
    message_type: "comment",
    subtype_xmlid: "mail.mt_note",
  }).catch(() => undefined);
}

export async function recordCallOutcome(input: CallOutcomeInput): Promise<{ attemptNo: number }> {
  const supabase = raw(createServiceRoleClient());

  const { count } = await supabase
    .from("call_attempts")
    .select("id", { count: "exact", head: true })
    .eq("contact_id", input.contactId);
  const attemptNo = (count ?? 0) + 1;

  await supabase.from("call_attempts").insert({
    contact_id: input.contactId,
    campaign_id: input.campaignId ?? null,
    variant_id: input.variantId ?? null,
    attempt_no: attemptNo,
    status: input.status ?? null,
    disposition: input.disposition,
    ai_disclosed_at: input.aiDisclosedAt ?? null,
    duration: input.duration ?? null,
    transferred_to: input.transferredTo ?? null,
    booked: input.booked ?? false,
    transcript_url: input.transcriptUrl ?? null,
    recording_url: input.recordingUrl ?? null,
    cost: input.cost ?? null,
  });

  const summary = `Call ${attemptNo} — ${input.disposition}${input.booked ? " · demo booked" : ""}${input.transferredTo ? ` · transferred to ${input.transferredTo}` : ""}`;
  await supabase.from("outreach_touches").insert({
    contact_id: input.contactId,
    channel: "voice",
    direction: "outbound",
    campaign_id: input.campaignId ?? null,
    summary,
  });

  // Outcome sync + task suppression note back to Odoo (the source of record).
  await writeOdooNote(input.contactId, `${summary}. Suppress next outbound task for this contact.`);

  return { attemptNo };
}
