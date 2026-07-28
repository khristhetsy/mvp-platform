import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";

/**
 * Founder-built manual outreach campaign — the Marketing-Hub-style builder in
 * Outreach → Manual. One campaign per company (draft that the founder edits).
 *
 * This layer only PERSISTS the campaign (audience, copy, sequence). Live email
 * dispatch reuses the platform send path and is gated separately, exactly like
 * automated outreach — see INVESTOR_OUTREACH_LIVE. Starting a campaign here marks
 * it "queued"; it does not itself email anyone.
 */

export type ManualSequenceStep = {
  label: string;
  dayOffset: number;
};

export type ManualOutreach = {
  status: "draft" | "queued";
  emailSubject: string;
  emailBody: string;
  sequence: ManualSequenceStep[];
  recipientIds: string[];
  stopOnReply: boolean;
};

function client(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

type Row = {
  status: string;
  email_subject: string | null;
  email_body: string | null;
  sequence: ManualSequenceStep[] | null;
  recipient_ids: string[] | null;
  stop_on_reply: boolean | null;
};

/** Load the founder's saved manual campaign, or null if none exists yet. */
export async function getManualOutreach(companyId: string): Promise<ManualOutreach | null> {
  const { data } = await client()
    .from("founder_manual_outreach")
    .select("status, email_subject, email_body, sequence, recipient_ids, stop_on_reply")
    .eq("company_id", companyId)
    .maybeSingle();
  if (!data) return null;
  const row = data as Row;
  return {
    status: row.status === "queued" ? "queued" : "draft",
    emailSubject: row.email_subject ?? "",
    emailBody: row.email_body ?? "",
    sequence: Array.isArray(row.sequence) ? row.sequence : [],
    recipientIds: Array.isArray(row.recipient_ids) ? row.recipient_ids : [],
    stopOnReply: row.stop_on_reply ?? true,
  };
}

/**
 * Upsert the founder's manual campaign. Verifies ownership first. `status`
 * distinguishes a plain save ("draft") from kicking it off ("queued").
 */
export async function saveManualOutreach(
  companyId: string,
  founderId: string,
  input: ManualOutreach,
): Promise<boolean> {
  const db = client();
  const { data: owned } = await db
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .eq("founder_id", founderId)
    .maybeSingle();
  if (!owned) return false;

  const { error } = await db.from("founder_manual_outreach").upsert(
    {
      company_id: companyId,
      status: input.status,
      email_subject: input.emailSubject,
      email_body: input.emailBody,
      sequence: input.sequence,
      recipient_ids: input.recipientIds,
      stop_on_reply: input.stopOnReply,
      created_by: founderId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "company_id" },
  );
  return !error;
}
