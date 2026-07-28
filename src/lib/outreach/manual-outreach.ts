import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send-email";
import { isOutreachLiveSendEnabled } from "@/lib/outreach/investor-outreach";
import { buildUnsubscribeUrl, filterUnsubscribed } from "@/lib/outreach/unsubscribe";
import { renderManualEmail } from "@/lib/outreach/manual-template";

const DAY_MS = 24 * 60 * 60 * 1000;

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

/**
 * Enroll the selected contacts into the campaign's send queue and stop anyone
 * who was deselected. New contacts start at step 0; existing recipients keep
 * their progress. Contacts without an email are skipped.
 */
export async function enrollManualRecipients(companyId: string, contactIds: string[]): Promise<void> {
  const db = client();
  const ids = [...new Set(contactIds)];

  // Stop recipients no longer in the selection (or all, if selection is empty).
  const stopQuery = db
    .from("founder_manual_outreach_recipients")
    .update({ status: "stopped", updated_at: new Date().toISOString() })
    .eq("company_id", companyId)
    .eq("status", "active");
  if (ids.length > 0) stopQuery.not("contact_id", "in", `(${ids.join(",")})`);
  await stopQuery;
  if (ids.length === 0) return;

  const { data: contacts } = await db
    .from("founder_investor_contacts")
    .select("id, investor_name, email")
    .eq("company_id", companyId)
    .in("id", ids);

  const rows = ((contacts ?? []) as Array<{ id: string; investor_name: string | null; email: string | null }>)
    .filter((c) => c.email)
    .map((c) => ({
      company_id: companyId,
      contact_id: c.id,
      email: (c.email as string).trim(),
      name: c.investor_name,
      next_step_index: 0,
      status: "active",
    }));

  if (rows.length > 0) {
    // Insert new enrollments; leave existing rows (and their progress) untouched.
    await db.from("founder_manual_outreach_recipients").upsert(rows, {
      onConflict: "company_id,contact_id",
      ignoreDuplicates: true,
    });
    // Re-activate any previously-stopped recipients that are selected again.
    await db
      .from("founder_manual_outreach_recipients")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("company_id", companyId)
      .eq("status", "stopped")
      .in("contact_id", rows.map((r) => r.contact_id));
  }
}

type CampaignRow = {
  company_id: string;
  email_subject: string | null;
  email_body: string | null;
  sequence: ManualSequenceStep[] | null;
};

type RecipientRow = {
  id: string;
  email: string;
  name: string | null;
  next_step_index: number;
  enrolled_at: string;
};

/**
 * Manual outreach send pass. For each queued campaign, sends each active
 * recipient the next sequence step that is due (relative to enrollment), then
 * advances them. Per-recipient step claim is atomic (guards on next_step_index)
 * so a step is never sent twice. Suppressed addresses are skipped. Real dispatch
 * only happens when INVESTOR_OUTREACH_LIVE=true; otherwise steps advance without
 * emailing — safe for end-to-end testing.
 */
export async function processManualOutreach(): Promise<{ sent: number; liveSend: boolean }> {
  const db = client();
  const live = isOutreachLiveSendEnabled();
  let sent = 0;

  const { data: campaigns } = await db
    .from("founder_manual_outreach")
    .select("company_id, email_subject, email_body, sequence")
    .eq("status", "queued");

  for (const campaign of (campaigns ?? []) as CampaignRow[]) {
    const steps = Array.isArray(campaign.sequence) ? campaign.sequence : [];
    if (steps.length === 0) continue;

    const { data: companyRow } = await db
      .from("companies")
      .select("company_name, industry, slug, is_published")
      .eq("id", campaign.company_id)
      .maybeSingle();
    const comp = (companyRow ?? {}) as {
      company_name?: string;
      industry?: string | null;
      slug?: string | null;
      is_published?: boolean | null;
    };
    const appBase = (process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com").replace(/\/$/, "");
    const previewUrl = comp.is_published && comp.slug ? `${appBase}/f/${comp.slug}` : null;

    const { data: recipients } = await db
      .from("founder_manual_outreach_recipients")
      .select("id, email, name, next_step_index, enrolled_at")
      .eq("company_id", campaign.company_id)
      .eq("status", "active");

    const batch = (recipients ?? []) as RecipientRow[];
    if (batch.length === 0) continue;

    // Suppression check (CAN-SPAM): never email an unsubscribed address.
    const suppressed = await filterUnsubscribed(batch.map((r) => r.email));
    const now = Date.now();

    for (const r of batch) {
      const stepIndex = r.next_step_index;
      if (stepIndex >= steps.length) {
        await db.from("founder_manual_outreach_recipients").update({ status: "completed" }).eq("id", r.id);
        continue;
      }
      const step = steps[stepIndex];
      const dueAt = new Date(r.enrolled_at).getTime() + (step.dayOffset ?? 0) * DAY_MS;
      if (now < dueAt) continue; // not due yet

      if (suppressed.has(r.email.trim().toLowerCase())) {
        await db.from("founder_manual_outreach_recipients").update({ status: "skipped" }).eq("id", r.id);
        continue;
      }

      const nextIndex = stepIndex + 1;
      const nowIso = new Date().toISOString();
      // Atomically claim this step (guard on current index) to prevent double-send.
      const { data: claimed } = await db
        .from("founder_manual_outreach_recipients")
        .update({
          next_step_index: nextIndex,
          last_sent_at: nowIso,
          status: nextIndex >= steps.length ? "completed" : "active",
          updated_at: nowIso,
        })
        .eq("id", r.id)
        .eq("next_step_index", stepIndex)
        .eq("status", "active")
        .select("id");
      if (!claimed || (claimed as Array<{ id: string }>).length === 0) continue;

      if (!live) {
        sent += 1;
        continue;
      }

      const firstName = (r.name ?? "").trim().split(/\s+/)[0] || null;
      const { subject, html, text } = renderManualEmail(campaign.email_subject ?? "", campaign.email_body ?? "", {
        firstName,
        company: comp.company_name ?? "our company",
        sector: comp.industry ?? null,
        previewUrl,
        unsubscribeUrl: buildUnsubscribeUrl(r.email),
      });
      const ok = await sendEmail({ to: r.email, subject, html, text });
      if (ok) {
        sent += 1;
      } else {
        // Revert the claim so the step retries on the next pass.
        await db
          .from("founder_manual_outreach_recipients")
          .update({ next_step_index: stepIndex, status: "active" })
          .eq("id", r.id);
      }
    }
  }

  return { sent, liveSend: live };
}
