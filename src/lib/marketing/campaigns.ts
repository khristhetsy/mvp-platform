import { marketingDb } from "./db";
import { makeUnsubscribeToken, sendMarketingEmail } from "./send";
import { isUnsubscribed } from "./contacts";
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
      subject: template.subject,
      html_body: template.html_body,
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

  await db
    .from("marketing_campaigns")
    .update({ status: "sent", sent_at: new Date().toISOString(), stat_sent: sent })
    .eq("id", campaignId);

  return { sent, skipped, failed };
}
