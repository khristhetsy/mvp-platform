import { marketingDb } from "./db";
import { makeUnsubscribeToken, sendMarketingEmail, emailConfigured } from "./send";
import { isUnsubscribed } from "./contacts";
import { emitNotification } from "./notifications/emit";
import { listAdminIds } from "./notifications/store";
import type { MarketingCampaign } from "./types";

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
  const template = campaign.template;
  if (!template) throw new Error("Template not attached");
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

  const subject = `[TEST] ${campaign.subject_override || template.subject}`;
  let html = campaign.body_override || template.html_body || "<p>(This campaign has no body yet.)</p>";
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
    text_body: template.text_body,
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

export async function sendCampaign(campaignId: string): Promise<{
  sent: number;
  skipped: number;
  failed: number;
}> {
  const db = await marketingDb();

  const { data: campaign, error: ce } = await db
    .from("marketing_campaigns")
    .select(`*, template:marketing_templates(*), list:marketing_lists(id)`)
    .eq("id", campaignId)
    .single();
  if (ce || !campaign) throw new Error("Campaign not found");

  const template = campaign.template;
  if (!template) throw new Error("Template not attached");

  // Don't pretend to send when the provider isn't configured — leave the
  // campaign as-is (scheduled/draft) so it retries once RESEND_API_KEY is set,
  // and surface a clear error to the caller / cron log.
  if (!emailConfigured()) {
    throw new Error("Email provider not configured — set RESEND_API_KEY in the environment before sending.");
  }

  const { data: members } = await db
    .from("marketing_list_contacts")
    .select("contact_id")
    .eq("list_id", campaign.list_id);

  if (!members || members.length === 0) return { sent: 0, skipped: 0, failed: 0 };

  const contactIds = members.map((m: { contact_id: string }) => m.contact_id);
  const { data: contacts } = await db
    .from("marketing_contacts")
    .select("*")
    .in("id", contactIds);

  if (!contacts) return { sent: 0, skipped: 0, failed: 0 };

  await updateCampaignStatus(campaignId, "sending");

  let sent = 0, skipped = 0, failed = 0;

  for (const contact of contacts) {
    const unsub = await isUnsubscribed(contact.email);
    if (unsub) { skipped++; continue; }

    const token = makeUnsubscribeToken(contact.email);
    const result = await sendMarketingEmail({
      to: contact.email,
      first_name: contact.first_name,
      company: contact.company,
      from_name: campaign.from_name,
      from_email: campaign.from_email,
      reply_to: campaign.reply_to,
      // Per-campaign edits override the shared template when present.
      subject: campaign.subject_override || template.subject,
      html_body: campaign.body_override || template.html_body,
      text_body: template.text_body,
      unsubscribe_token: token,
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
    } else {
      failed++;
    }

    await new Promise((r) => setTimeout(r, 200));
  }

  // If every recipient failed (e.g. sender domain not verified), don't mark it
  // "sent" — pause it so the failure is visible and can be retried after a fix.
  const finalStatus = sent === 0 && failed > 0 ? "paused" : "sent";
  await db
    .from("marketing_campaigns")
    .update({ status: finalStatus, sent_at: sent > 0 ? new Date().toISOString() : null, stat_sent: sent })
    .eq("id", campaignId);

  // Notify — "batch send complete". Goes to the campaign owner, or all admins if
  // there's no owner. Best-effort: never let a notification failure break a send.
  try {
    const owner = (campaign.created_by as string | null) ?? null;
    const admins = owner ? [owner] : await listAdminIds();
    const name = (campaign.name as string) ?? "Campaign";
    const body = `“${name}” finished — ${sent} delivered${failed ? `, ${failed} failed` : ""}${skipped ? `, ${skipped} skipped` : ""}.`;
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

  return { sent, skipped, failed };
}
