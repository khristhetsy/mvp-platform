import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send-email";
import { isOutreachLiveSendEnabled } from "@/lib/outreach/investor-outreach";
import { buildUnsubscribeUrl, filterUnsubscribed } from "@/lib/outreach/unsubscribe";
import { renderManualEmail } from "@/lib/outreach/manual-template";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Reply-to address that encodes the recipient, e.g. replies+<id>@icapos.com, so
 * an inbound reply can be traced back to the exact sequence recipient. Returns
 * null when OUTREACH_REPLY_ADDRESS isn't configured (reply-stop then inactive).
 */
export function replyAddressFor(recipientId: string): string | null {
  const base = process.env.OUTREACH_REPLY_ADDRESS;
  if (!base || !base.includes("@")) return null;
  const [local, domain] = base.split("@");
  return `${local}+${recipientId}@${domain}`;
}

/** Extract the recipient id from a replies+<id>@domain address. */
export function parseReplyRecipientId(toAddress: string): string | null {
  const m = toAddress.match(/\+([0-9a-fA-F-]{36})@/);
  return m ? m[1] : null;
}

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

export type ManualRecipientStatus = {
  name: string | null;
  email: string;
  status: string;
  sentAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  repliedAt: string | null;
};

/** Per-recipient send/engagement status for the builder, most recent first. */
export async function getManualRecipients(companyId: string): Promise<ManualRecipientStatus[]> {
  const { data } = await client()
    .from("founder_manual_outreach_recipients")
    .select("name, email, status, last_sent_at, opened_at, clicked_at, replied_at")
    .eq("company_id", companyId);
  const rows = (data ?? []) as Array<{
    name: string | null;
    email: string;
    status: string;
    last_sent_at: string | null;
    opened_at: string | null;
    clicked_at: string | null;
    replied_at: string | null;
  }>;
  return rows
    .map((r) => ({
      name: r.name,
      email: r.email,
      status: r.status,
      sentAt: r.last_sent_at,
      openedAt: r.opened_at,
      clickedAt: r.clicked_at,
      repliedAt: r.replied_at,
    }))
    .sort((a, b) => {
      const at = a.repliedAt ?? a.clickedAt ?? a.openedAt ?? a.sentAt;
      const bt = b.repliedAt ?? b.clickedAt ?? b.openedAt ?? b.sentAt;
      return (bt ? Date.parse(bt) : 0) - (at ? Date.parse(at) : 0);
    });
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
      const ok = await sendEmail({
        to: r.email,
        subject,
        html,
        text,
        // Route replies to the tokenized inbound address so the sequence can stop
        // on reply (falls back to no reply-to when inbound isn't configured).
        replyTo: replyAddressFor(r.id) ?? undefined,
      });
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

/**
 * Record an inbound reply and stop that recipient's remaining sequence steps
 * when the campaign has stop-on-reply enabled. Matches by recipient token first
 * (precise), falling back to the sender's email address.
 */
export async function handleInboundReply(input: {
  recipientId?: string | null;
  fromEmail?: string | null;
}): Promise<{ stopped: number }> {
  const db = client();
  type R = { id: string; company_id: string; status: string };
  let recipients: R[] = [];

  if (input.recipientId) {
    const { data } = await db
      .from("founder_manual_outreach_recipients")
      .select("id, company_id, status")
      .eq("id", input.recipientId)
      .maybeSingle();
    if (data) recipients = [data as R];
  } else if (input.fromEmail) {
    const { data } = await db
      .from("founder_manual_outreach_recipients")
      .select("id, company_id, status")
      .ilike("email", input.fromEmail.trim())
      .eq("status", "active");
    recipients = (data ?? []) as R[];
  }

  let stopped = 0;
  const nowIso = new Date().toISOString();
  for (const r of recipients) {
    const { data: camp } = await db
      .from("founder_manual_outreach")
      .select("stop_on_reply")
      .eq("company_id", r.company_id)
      .maybeSingle();
    const stop = (camp as { stop_on_reply?: boolean } | null)?.stop_on_reply !== false;
    await db
      .from("founder_manual_outreach_recipients")
      .update({ replied_at: nowIso, status: stop ? "stopped" : r.status, updated_at: nowIso })
      .eq("id", r.id);
    if (stop) stopped += 1;
  }
  return { stopped };
}

/** Look up who to forward an inbound reply to (the founder who owns the campaign). */
export async function resolveReplyForward(
  recipientId: string,
): Promise<{ founderEmail: string; investorName: string | null; companyName: string | null } | null> {
  const db = client();
  const { data: r } = await db
    .from("founder_manual_outreach_recipients")
    .select("company_id, name, email")
    .eq("id", recipientId)
    .maybeSingle();
  if (!r) return null;
  const rec = r as { company_id: string; name: string | null; email: string };

  const { data: c } = await db
    .from("companies")
    .select("company_name, founder_id")
    .eq("id", rec.company_id)
    .maybeSingle();
  const comp = c as { company_name: string | null; founder_id: string | null } | null;
  if (!comp?.founder_id) return null;

  const { data: p } = await db.from("profiles").select("email").eq("id", comp.founder_id).maybeSingle();
  const email = (p as { email: string | null } | null)?.email;
  if (!email) return null;

  return { founderEmail: email, investorName: rec.name ?? rec.email, companyName: comp.company_name };
}
