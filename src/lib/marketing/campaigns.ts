import { marketingDb } from "./db";
import { makeUnsubscribeToken, sendMarketingEmail, emailConfigured } from "./send";
import { isUnsubscribed } from "./contacts";
import { emitNotification } from "./notifications/emit";
import { listAdminIds } from "./notifications/store";
import type { MarketingCampaign } from "./types";
import { needsEmailReview } from "./recipient";
import { isMatchCampaign } from "./match-campaign/types";
import { sendMatchCampaign } from "./match-campaign/send";
import { queueCampaignNotesLog } from "@/lib/notes-log";

export async function getCampaigns(): Promise<MarketingCampaign[]> {
  const db = await marketingDb();
  const { data, error } = await db
    .from("marketing_campaigns")
    .select(`
      *,
      list:marketing_lists(id, name),
      template:marketing_templates(id, name, subject)
    `)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MarketingCampaign[];
}

export async function createCampaign(
  input: Partial<MarketingCampaign>,
  createdBy?: string
): Promise<MarketingCampaign> {
  const db = await marketingDb();
  const { data, error } = await db
    .from("marketing_campaigns")
    .insert({ ...input, ...(createdBy ? { created_by: createdBy } : {}) })
    .select()
    .single();
  if (error) throw error;
  return data as MarketingCampaign;
}

/**
 * Statuses a campaign may be sent from. `sending` is excluded so a cron pass and
 * a manual click can't double-send; `sent`, `paused`, and `cancelled` are
 * excluded so a finished or stopped campaign can't be re-blasted to the list.
 */
const SENDABLE_STATUSES: ReadonlyArray<MarketingCampaign["status"]> = ["draft", "scheduled"];

/**
 * A send that stopped partway (a function time limit, a crash) can be resumed. A campaign left
 * "sending" counts as stopped once nothing has touched it for this long; a running send updates
 * it every few emails.
 */
export const RESUME_STALE_MS = 2 * 60 * 1000;
/** How many emails go out between "still running" updates on the campaign. */
const HEARTBEAT_EVERY = 25;

/** True once a send has used up its time budget. No budget means it never stops early. */
export function budgetSpent(startedAt: number, now: number, budgetMs?: number): boolean {
  return budgetMs != null && now - startedAt >= budgetMs;
}

/** Splits the list into contacts still to send and the number already sent (resume only). */
export function splitSent<T extends { id: string }>(contacts: T[], alreadySent: ReadonlySet<string>): { todo: T[]; done: number } {
  if (alreadySent.size === 0) return { todo: contacts, done: 0 };
  const todo = contacts.filter((c) => !alreadySent.has(c.id));
  return { todo, done: contacts.length - todo.length };
}

/**
 * Kill switch for all marketing sending. Defaults to ENABLED — only an explicit
 * "false" disables it, so setting it is a deliberate act and leaving it unset
 * doesn't silently stop campaigns.
 */
export function marketingSendEnabled(): boolean {
  return process.env.MARKETING_SEND_LIVE !== "false";
}

export async function updateCampaignStatus(
  id: string,
  status: MarketingCampaign["status"]
): Promise<void> {
  const db = await marketingDb();
  const { error } = await db
    .from("marketing_campaigns")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Send ONE test copy of a campaign to a single address (typically the admin's own
 * email) so delivery + open + click tracking can be validated against a real inbox.
 * Records a `sent` marketing_event (metadata.test = true) tied to the campaign so the
 * resulting open/click webhook events match by resend_id and show up in analytics.
 * Does NOT bump the campaign's headline stat_sent. Guarantees a trackable link in the
 * body so click tracking is testable even for link-less templates.
 */
export async function sendCampaignTest(
  campaignId: string,
  toEmail: string,
): Promise<{ ok: boolean; to: string; resend_id: string | null; error?: string }> {
  const email = (toEmail ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, to: toEmail, resend_id: null, error: "A valid recipient email is required." };
  }

  const db = await marketingDb();
  const { data: campaign, error: ce } = await db
    .from("marketing_campaigns")
    .select(`*, template:marketing_templates(*)`)
    .eq("id", campaignId)
    .single();
  if (ce || !campaign) throw new Error("Campaign not found");
  // A campaign is sendable with either an attached template or a body_override
  // (event emails carry their fully-rendered HTML in body_override, no template).
  const template = campaign.template;
  if (!template && !campaign.body_override) throw new Error("Template not attached");
  if (!emailConfigured()) {
    throw new Error("Email provider not configured — set RESEND_API_KEY before sending.");
  }

  // Reusable internal contact for the test recipient — satisfies the not-null
  // contact_id on marketing_events and lets the webhook match opens/clicks back.
  const { data: contactRow } = await db
    .from("marketing_contacts")
    .upsert({ email, first_name: "Test", source: "internal_test", updated_at: new Date().toISOString() }, { onConflict: "email" })
    .select("id")
    .single();
  const contactId = (contactRow as { id: string } | null)?.id ?? null;

  const subject = `[TEST] ${campaign.subject_override || template?.subject || "(no subject)"}`;
  let html = campaign.body_override || template?.html_body || "<p>(This campaign has no body yet.)</p>";
  if (!/<a\s/i.test(html)) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com";
    html += `<p style="margin-top:16px;"><a href="${appUrl}">Test link — click me to verify click tracking</a></p>`;
  }

  const result = await sendMarketingEmail({
    to: email,
    first_name: "there",
    company: null,
    from_name: campaign.from_name,
    from_email: campaign.from_email,
    reply_to: campaign.reply_to,
    subject,
    html_body: html,
    text_body: template?.text_body ?? null,
    unsubscribe_token: makeUnsubscribeToken(email),
  });

  if (contactId) {
    await db.from("marketing_events").insert({
      campaign_id: campaignId,
      contact_id: contactId,
      email,
      resend_id: result.resend_id,
      event_type: result.ok ? "sent" : "failed",
      metadata: { test: true, ...(result.error ? { error: result.error } : {}) },
    });
  }

  return { ok: result.ok, to: email, resend_id: result.resend_id, error: result.error };
}

export async function sendCampaign(campaignId: string, opts?: {
  /** Files attached to every email of this send (the mass-email dialog). Not stored on the campaign. */
  attachments?: Array<{ filename: string; content: string }>;
  /** Mass email logs its sends as "email" itself, so it skips the campaign Notes log. */
  skipNotesLog?: boolean;
  /**
   * Stop after this many milliseconds and leave the campaign "paused" with `remaining` set, so a long
   * list never runs into the function time limit. Without it the whole list goes out in one call.
   */
  timeBudgetMs?: number;
  /** Continue a campaign that stopped partway. Contacts that already have a "sent" event are skipped. */
  resume?: boolean;
}): Promise<{
  sent: number;
  skipped: number;
  failed: number;
  /** Contacts still to send when the time budget ran out (0 when the campaign finished). */
  remaining?: number;
  /** Emails sent by this call only, for the sales timeline. */
  sentEmails?: string[];
  /** Emails sent across all calls so far, this one included. */
  sentSoFar?: number;
}> {
  const db = await marketingDb();

  const { data: campaign, error: ce } = await db
    .from("marketing_campaigns")
    .select(`*, template:marketing_templates(*), list:marketing_lists(id)`)
    .eq("id", campaignId)
    .single();
  if (ce || !campaign) throw new Error("Campaign not found");

  // Match campaigns: one email per founder with their own matches. Same status
  // gate and kill switch as below, then the Match sender takes over.
  if (isMatchCampaign(campaign)) {
    const matchStatus = campaign.status as MarketingCampaign["status"];
    if (!SENDABLE_STATUSES.includes(matchStatus)) {
      throw new Error(
        matchStatus === "sending"
          ? "This campaign is already sending. Wait for it to finish before sending again."
          : `Cannot send a campaign with status "${matchStatus}".`,
      );
    }
    if (!marketingSendEnabled()) {
      throw new Error("Marketing sending is disabled (MARKETING_SEND_LIVE=false). No email was sent.");
    }
    return sendMatchCampaign(campaignId);
  }

  // A campaign is sendable with either an attached template or a body_override
  // (event emails carry their fully-rendered HTML in body_override, no template).
  const template = campaign.template;
  if (!template && !campaign.body_override) throw new Error("Template not attached");

  // Status gate. Previously any campaign sent regardless of status, so a cron
  // pass and a manual click could both fire the same campaign (double-sending to
  // the whole list), and a finished or cancelled campaign could be re-blasted.
  // `draft` and `scheduled` stay sendable — sending a draft directly is the
  // normal admin flow — but terminal and in-flight states are refused.
  const status = campaign.status as MarketingCampaign["status"];
  if (opts?.resume) {
    // Quick check here; the real claim (one caller at a time) happens just before sending starts.
    if (status !== "paused" && status !== "sending") {
      throw new Error("This campaign can't be resumed now: it has finished, or never started.");
    }
  } else if (!SENDABLE_STATUSES.includes(status)) {
    throw new Error(
      status === "sending"
        ? "This campaign is already sending. Wait for it to finish before sending again."
        : `Cannot send a campaign with status "${status}". Duplicate it to send again.`,
    );
  }

  // Emergency brake. Sending stays enabled unless this is explicitly set to
  // "false", so turning it off is a deliberate act and normal operation is
  // unaffected.
  if (!marketingSendEnabled()) {
    throw new Error("Marketing sending is disabled (MARKETING_SEND_LIVE=false). No email was sent.");
  }

  // Don't pretend to send when the provider isn't configured — leave the
  // campaign as-is (scheduled/draft) so it retries once RESEND_API_KEY is set,
  // and surface a clear error to the caller / cron log.
  if (!emailConfigured()) {
    throw new Error("Email provider not configured — set RESEND_API_KEY in the environment before sending.");
  }

  // Read the whole list. One select returns at most 1,000 rows, and one .in() with
  // 1,000+ ids overflows the request URL, so both are paged. Errors are thrown:
  // before, a failed read returned zeros and a 1,000+ recipient send looked fine
  // while nothing went out.
  const contactIds: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data: page, error: me } = await db
      .from("marketing_list_contacts")
      .select("contact_id")
      .eq("list_id", campaign.list_id)
      .order("contact_id")
      .range(from, from + 999);
    if (me) throw new Error(`Couldn't read the campaign's list: ${me.message}`);
    const rows = (page ?? []) as Array<{ contact_id: string }>;
    for (const m of rows) contactIds.push(m.contact_id);
    if (rows.length < 1000) break;
  }

  if (contactIds.length === 0) return { sent: 0, skipped: 0, failed: 0 };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contacts: any[] = [];
  for (let i = 0; i < contactIds.length; i += 200) {
    const { data: chunk, error: ke } = await db
      .from("marketing_contacts")
      .select("*")
      .in("id", contactIds.slice(i, i + 200));
    if (ke) throw new Error(`Couldn't load the campaign's contacts: ${ke.message}`);
    contacts.push(...(chunk ?? []));
  }

  if (opts?.resume) {
    // One caller at a time: the claim only succeeds for a paused campaign, or one that says
    // "sending" but has not been touched for RESUME_STALE_MS (its function died).
    const now = new Date().toISOString();
    const stale = new Date(Date.now() - RESUME_STALE_MS).toISOString();
    const first = await db.from("marketing_campaigns").update({ status: "sending", updated_at: now }).eq("id", campaignId).eq("status", "paused").select("id");
    let claimed = (first.data ?? []).length > 0;
    if (!claimed) {
      const second = await db.from("marketing_campaigns").update({ status: "sending", updated_at: now }).eq("id", campaignId).eq("status", "sending").lt("updated_at", stale).select("id");
      claimed = (second.data ?? []).length > 0;
    }
    if (!claimed) throw new Error("This campaign can't be resumed now: it has finished, or another send is still running.");
  } else {
    await updateCampaignStatus(campaignId, "sending");
  }

  // On a resume, contacts that already have a "sent" event are skipped, so nobody gets it twice.
  const alreadySent = new Set<string>();
  if (opts?.resume) {
    for (let from = 0; ; from += 1000) {
      const { data: page, error: pe } = await db
        .from("marketing_events")
        .select("contact_id")
        .eq("campaign_id", campaignId)
        .eq("event_type", "sent")
        .order("id")
        .range(from, from + 999);
      if (pe) throw new Error(`Couldn't read what was already sent: ${pe.message}`);
      const rows = (page ?? []) as Array<{ contact_id: string }>;
      for (const r of rows) alreadySent.add(r.contact_id);
      if (rows.length < 1000) break;
    }
  }
  const { todo, done: sentBefore } = splitSent(contacts, alreadySent);

  let sent = 0, skipped = 0, failed = 0;
  const sentEmails: string[] = [];
  const startedAt = Date.now();
  let remaining = 0;

  for (let i = 0; i < todo.length; i++) {
    const contact = todo[i];
    if (budgetSpent(startedAt, Date.now(), opts?.timeBudgetMs)) { remaining = todo.length - i; break; }
    if (i > 0 && i % HEARTBEAT_EVERY === 0) {
      await db.from("marketing_campaigns").update({ updated_at: new Date().toISOString(), stat_sent: sentBefore + sent }).eq("id", campaignId);
    }
    if (needsEmailReview(contact.tags)) { skipped++; continue; }
    const unsub = await isUnsubscribed(contact.email);
    if (unsub) { skipped++; continue; }

    const token = makeUnsubscribeToken(contact.email);
    const result = await sendMarketingEmail({
      to: contact.email,
      first_name: contact.first_name,
      last_name: contact.last_name,
      company: contact.company,
      from_name: campaign.from_name,
      from_email: campaign.from_email,
      reply_to: campaign.reply_to,
      // Per-campaign edits override the shared template when present.
      subject: campaign.subject_override || template?.subject || "(no subject)",
      html_body: campaign.body_override || template?.html_body || "",
      text_body: template?.text_body ?? null,
      unsubscribe_token: token,
      attachments: opts?.attachments,
    });

    await db.from("marketing_events").insert({
      campaign_id: campaignId,
      contact_id: contact.id,
      email: contact.email,
      resend_id: result.resend_id,
      event_type: result.ok ? "sent" : "failed",
      metadata: result.error ? { error: result.error } : {},
    });

    if (result.ok) {
      sent++;
      sentEmails.push(contact.email);
    } else {
      failed++;
    }

    await new Promise((r) => setTimeout(r, 200));
  }

  const sentSoFar = sentBefore + sent;

  // Out of time with contacts left: pause (not "sent"), so the campaign can be resumed and shows
  // honestly how far it got. Notifications and the Notes log wait for the real finish.
  if (remaining > 0) {
    await db
      .from("marketing_campaigns")
      .update({ status: "paused", stat_sent: sentSoFar, updated_at: new Date().toISOString() })
      .eq("id", campaignId);
    return { sent, skipped, failed, remaining, sentEmails, sentSoFar };
  }

  // If every recipient failed (e.g. sender domain not verified), don't mark it
  // "sent" — pause it so the failure is visible and can be retried after a fix.
  const finalStatus = sentSoFar === 0 && failed > 0 ? "paused" : "sent";
  await db
    .from("marketing_campaigns")
    .update({ status: finalStatus, sent_at: sentSoFar > 0 ? new Date().toISOString() : null, stat_sent: sentSoFar })
    .eq("id", campaignId);

  // Notify — "batch send complete". Goes to the campaign owner, or all admins if
  // there's no owner. Best-effort: never let a notification failure break a send.
  try {
    const owner = (campaign.created_by as string | null) ?? null;
    const admins = owner ? [owner] : await listAdminIds();
    const name = (campaign.name as string) ?? "Campaign";
    const body = `“${name}” finished — ${sentSoFar} delivered${failed ? `, ${failed} failed` : ""}${skipped ? `, ${skipped} skipped` : ""}.`;
    await Promise.all(
      admins.map((adminId) =>
        emitNotification({
          adminId,
          typeId: "campaigns.batch_complete",
          title: "Batch send complete",
          body,
          link: "/admin/marketing/campaigns",
          dedupeKey: `campaigns.batch_complete:${campaignId}`,
        }),
      ),
    );
  } catch {
    /* notifications are best-effort */
  }

  // Notes log: after every send is done, in the background, batched (src/lib/notes-log.ts).
  if (!opts?.skipNotesLog && sentSoFar > 0) {
    queueCampaignNotesLog({
      id: campaignId, name: (campaign.name as string) ?? "Campaign",
      subject: campaign.subject_override || template?.subject || "(no subject)",
    });
  }

  return { sent, skipped, failed, remaining: 0, sentEmails, sentSoFar };
}
