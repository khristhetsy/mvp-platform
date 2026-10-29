/**
 * Mass email / sequence enroll from a Contacts or Opportunities selection.
 *
 * Reuses the marketing engines rather than reinventing them:
 *  - iCapOS send  → hidden list + campaign + sendCampaign (tracked, unsubscribe-safe,
 *                   logged to marketing_events so opens/clicks land in Analytics).
 *  - Gmail send   → per-recipient sendViaGmail from the staff member's own inbox, with a
 *                   conservative daily cap guard (Gmail throttles bulk).
 *  - Sequence     → hidden list + enrollList (idempotent; already-enrolled skipped).
 *  - Test         → one copy to a chosen address with sample merge data, either channel.
 *  - Companies    → source "companies" (the admin Companies list): one email per company's
 *                   founder, each filled with that company's own At a glance numbers
 *                   ({{crr_score}} …). Demo and internal accounts never receive real email.
 *  - Attachments  → files uploaded through /api/email/attachments ride along on every
 *                   send (and the test), up to 10 MB in total.
 *
 * Staff-only.
 */

import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { resolveContactIds } from "@/lib/sales/bulk-targets";
import { oppIdsToCrmIds, crmIdsToMarketingContacts, createHiddenList, upsertFounderContacts } from "@/lib/marketing/selection";
import { resolveCompanyRecipients } from "@/lib/marketing/company-recipients";
import { glanceVars, fillGlance } from "@/lib/email/company-glance";
import { marketingDb } from "@/lib/marketing/db";
import { getTemplate } from "@/lib/marketing/templates";
import { createCampaign, sendCampaign, marketingSendEnabled, updateCampaignStatus } from "@/lib/marketing/campaigns";
import { enrollList } from "@/lib/marketing/sequences";
import { sendMarketingEmail, makeUnsubscribeToken, interpolate, htmlToText, emailConfigured } from "@/lib/marketing/send";
import { isUnsubscribed } from "@/lib/marketing/contacts";
import { sendViaGmail, type GmailAttachment } from "@/lib/integrations/gmail-send";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { logOutboundEmailActivity } from "@/lib/sales/activity";
import { scheduleAtFrom, scheduleSend } from "@/lib/scheduled-emails/schedule";

export const dynamic = "force-dynamic";
// Sends go out one recipient at a time with a short delay, so a large selection needs more
// than the default function time.
export const maxDuration = 300;

// Conservative Gmail daily cap — Workspace allows ~500 external/day (less on consumer
// accounts). Above this we refuse and steer to iCapOS rather than risk a block.
const GMAIL_DAILY_LIMIT = 450;
const MAX_TARGET = 25000;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const ATTACH_BUCKET = "email-attachments";
const MAX_ATTACH_BYTES = 10 * 1024 * 1024;

const schema = z.object({
  source: z.enum(["contacts", "opportunities", "companies"]),
  mode: z.enum(["ids", "filter"]),
  ids: z.array(z.string().uuid()).max(MAX_TARGET).optional(),
  params: z.string().max(20_000).optional(),
  group: z.string().max(40).optional(),
  action: z.enum(["send", "test", "sequence"]),
  channel: z.enum(["icapos", "gmail"]).optional(),
  templateId: z.string().uuid().nullish(),
  subject: z.string().max(300).nullish(),
  // Rich templates with inline images run past 150k characters; 1M leaves headroom.
  html: z.string().max(1_000_000).nullish(),
  fromName: z.string().max(120).nullish(),
  fromEmail: z.string().max(200).nullish(),
  replyTo: z.string().max(200).nullish(),
  testEmail: z.string().max(200).nullish(),
  sequenceId: z.string().uuid().nullish(),
  attachments: z.array(z.object({
    name: z.string().max(200), path: z.string().max(400), size: z.number().int().nonnegative(), content_type: z.string().nullish(),
  })).max(10).optional(),
});

/** The uploaded files' bytes, from the staff member's own folder in Storage. */
async function loadAttachments(userId: string, refs: NonNullable<z.infer<typeof schema>["attachments"]>): Promise<GmailAttachment[] | { error: string }> {
  if (refs.length === 0) return [];
  if (refs.some((a) => !a.path.startsWith(`${userId}/`))) return { error: "An attachment couldn't be found. Remove it and attach it again." };
  if (refs.reduce((n, a) => n + a.size, 0) > MAX_ATTACH_BYTES) return { error: "Attachments are over 10 MB in total. Remove one and try again." };
  const admin = createServiceRoleClient();
  const out: GmailAttachment[] = [];
  for (const a of refs) {
    const { data, error } = await admin.storage.from(ATTACH_BUCKET).download(a.path);
    if (error || !data) return { error: `Couldn't read ${a.name}. Remove it and attach it again.` };
    out.push({ name: a.name, mimeType: a.content_type || "application/octet-stream", content: Buffer.from(await data.arrayBuffer()) });
  }
  return out;
}

type FounderMail = { vars: Record<string, string> };

/** One company's merge values: the founder's name and company plus the At a glance numbers. Null when the company can't be loaded. */
async function founderVars(companyId: string, base: Record<string, string>): Promise<FounderMail | null> {
  // Loaded here, not at the top, so the route stays light for the other sources.
  const { getAdminCompanyWorkspace } = await import("@/lib/admin/company-workspace");
  const data = await getAdminCompanyWorkspace(companyId).catch(() => null);
  return data ? { vars: { ...base, ...glanceVars(data) } } : null;
}

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const raw: unknown = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const d = parsed.data;
  if (d.action === "send" && scheduleAtFrom(raw)) {
    // Schedule send: stored now. The selection, template and recipients resolve at send time.
    if (!d.templateId && !d.subject && !d.html) return NextResponse.json({ error: "Pick a template or write a subject/body first." }, { status: 400 });
    const n = d.mode === "ids" ? (d.ids ?? []).length : 0;
    let subj = d.subject ?? "";
    if (!subj && d.templateId) subj = (await getTemplate(d.templateId))?.subject ?? "";
    return scheduleSend({ kind: "mass_email", userId: profile.id, raw, toLabel: n ? `${n.toLocaleString()} ${d.source === "opportunities" ? "opportunities" : d.source === "companies" ? "founders" : "contacts"}` : `Filtered ${d.source}`, subject: subj });
  }
  const files = await loadAttachments(profile.id, d.attachments ?? []);
  if ("error" in files) return NextResponse.json({ error: files.error }, { status: 400 });
  const resendFiles = files.map((f) => ({ filename: f.name, content: f.content.toString("base64") }));

  // ── Resolve the selection to crm_contacts ids ──────────────────────────────
  let crmIds: string[] = [];
  if (d.source === "companies") {
    if (d.action === "sequence") return NextResponse.json({ error: "Sequences aren't available for founders. Use Send once." }, { status: 400 });
    if (d.mode !== "ids") return NextResponse.json({ error: "Pick the companies to email." }, { status: 400 });
  } else if (d.source === "opportunities") {
    crmIds = await oppIdsToCrmIds([...new Set(d.ids ?? [])]);
  } else if (d.mode === "ids") {
    crmIds = [...new Set(d.ids ?? [])];
  } else {
    try {
      crmIds = await resolveContactIds(profile, { mode: "filter", params: d.params, group: d.group });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't resolve the selection." }, { status: 500 });
    }
  }

  // ── Resolve the email content (template or written-fresh) ──────────────────
  let subject = d.subject ?? "";
  let html = d.html ?? "";
  let text: string | null = null;
  if (d.templateId) {
    const t = await getTemplate(d.templateId);
    if (!t) return NextResponse.json({ error: "Template not found." }, { status: 404 });
    subject = d.subject || t.subject;
    html = d.html || t.html_body;
    text = t.text_body ?? null;
  }
  const fromName = d.fromName?.trim() || (profile.full_name ?? "iCapOS");
  const fromEmail = d.fromEmail?.trim() || "outreach@icapos.com";

  // ── TEST: one copy with sample merge data ──────────────────────────────────
  if (d.action === "test") {
    const to = (d.testEmail ?? profile.email ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(to)) return NextResponse.json({ error: "A valid test address is required." }, { status: 400 });
    if (d.action === "test" && !subject && !html) return NextResponse.json({ error: "Pick a template or write a subject/body first." }, { status: 400 });
    let vars: Record<string, string> = { first_name: "Spencer", last_name: "Scherer", company: "newf.tech", email: to, sender_name: fromName };
    if (d.source === "companies") {
      // The test shows the first selected founder's own numbers, sent only to the test address.
      const first = (await resolveCompanyRecipients((d.ids ?? []).slice(0, 25))).recipients[0];
      const fm = first ? await founderVars(first.companyId, { first_name: first.first_name ?? "there", last_name: first.last_name ?? "", company: first.companyName, email: to, sender_name: fromName }) : null;
      if (!fm) return NextResponse.json({ error: "No founder in the selection to preview." }, { status: 400 });
      vars = fm.vars;
    }
    const subjOut = `[TEST] ${interpolate(fillGlance(subject, vars), vars)}`;
    const htmlOut = interpolate(fillGlance(html, vars), vars);
    if ((d.channel ?? "icapos") === "gmail") {
      const r = await sendViaGmail({ userId: profile.id, to, subject: subjOut, body: htmlToText(htmlOut), html: htmlOut, attachments: files });
      return "error" in r
        ? NextResponse.json({ error: r.error.message }, { status: 400 })
        : NextResponse.json({ ok: true, to });
    }
    if (!emailConfigured()) return NextResponse.json({ error: "Email provider not configured (RESEND_API_KEY)." }, { status: 400 });
    const r = await sendMarketingEmail({ to, first_name: vars.first_name, company: vars.company, from_name: fromName, from_email: fromEmail, reply_to: d.replyTo ?? null, subject: subjOut, html_body: htmlOut, text_body: text, unsubscribe_token: makeUnsubscribeToken(to), attachments: resendFiles });
    return r.ok ? NextResponse.json({ ok: true, to }) : NextResponse.json({ error: r.error ?? "Test send failed." }, { status: 400 });
  }

  if (d.source === "companies") return sendToFounders({ d, profile, subject, html, text, fromName, fromEmail, files, resendFiles });

  if (crmIds.length === 0) return NextResponse.json({ error: "No contacts in the selection." }, { status: 400 });

  const { recipients, skippedNoEmail, skippedGuess } = await crmIdsToMarketingContacts(crmIds);
  if (recipients.length === 0) {
    const why = skippedGuess > 0 ? "None of the selected contacts have a confirmed email address (guessed addresses are held back)." : "None of the selected contacts have an email address.";
    return NextResponse.json({ error: why }, { status: 400 });
  }

  // ── SEQUENCE: enroll the selection ─────────────────────────────────────────
  if (d.action === "sequence") {
    if (!d.sequenceId) return NextResponse.json({ error: "Pick a sequence." }, { status: 400 });
    const listId = await createHiddenList(recipients.map((r) => r.id), `(Sequence) ${new Date().toISOString().slice(0, 10)}`);
    const { enrolled } = await enrollList(d.sequenceId, listId);
    return NextResponse.json({ ok: true, enrolled, skippedNoEmail, skippedGuess });
  }

  // ── SEND ───────────────────────────────────────────────────────────────────
  if (!subject && !html) return NextResponse.json({ error: "Pick a template or write a subject/body first." }, { status: 400 });
  const channel = d.channel ?? "icapos";

  if (channel === "gmail") {
    if (recipients.length > GMAIL_DAILY_LIMIT) {
      return NextResponse.json({ error: `${recipients.length.toLocaleString()} recipients exceeds the Gmail daily limit (~${GMAIL_DAILY_LIMIT}). Use iCapOS Email for a send this size, or reduce the selection.` }, { status: 400 });
    }
    let sent = 0, skipped = 0, failed = 0;
    for (const rcpt of recipients) {
      if (await isUnsubscribed(rcpt.email)) { skipped++; continue; }
      const vars = { first_name: rcpt.first_name ?? "there", company: rcpt.company ?? "", email: rcpt.email, sender_name: fromName };
      const htmlOut = interpolate(html, vars);
      const r = await sendViaGmail({ userId: profile.id, to: rcpt.email, subject: interpolate(subject, vars), body: htmlToText(htmlOut), html: htmlOut, attachments: files });
      if ("error" in r) failed++; else sent++;
      await new Promise((res) => setTimeout(res, 120));
    }
    // Log to the sales timeline so the send shows on each contact + their open opps.
    const gmailEmails = recipients.map((rc) => rc.email);
    after(() => logOutboundEmailActivity(gmailEmails, subject || "(no subject)", profile.id, 1000));
    return NextResponse.json({ ok: true, channel: "gmail", sent, skipped, failed, skippedNoEmail, skippedGuess });
  }

  // iCapOS: hidden list + campaign + sendCampaign (full tracking + analytics).
  const listId = await createHiddenList(recipients.map((r) => r.id), `(Email) ${(subject || "Untitled").slice(0, 60)} · ${new Date().toISOString().slice(0, 10)}`);
  const campaign = await createCampaign({
    name: `Email · ${(subject || "Untitled").slice(0, 60)} · ${new Date().toISOString().slice(0, 10)}`,
    list_id: listId,
    template_id: d.templateId ?? null,
    from_name: fromName,
    from_email: fromEmail,
    reply_to: d.replyTo ?? null,
    subject_override: subject || null,
    body_override: d.templateId && !d.html ? null : html || null,
    status: "draft",
  }, profile.id);

  try {
    const result = await sendCampaign(campaign.id, { attachments: resendFiles, skipNotesLog: true });
    // Log to the sales timeline so the send shows on each contact + their open opps.
    const icaposEmails = recipients.map((r) => r.email);
    after(() => logOutboundEmailActivity(icaposEmails, subject || "(no subject)", profile.id, 1000));
    return NextResponse.json({ ok: true, channel: "icapos", campaignId: campaign.id, ...result, skippedNoEmail, skippedGuess });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Send failed." }, { status: 400 });
  }
}

type FounderSend = {
  d: z.infer<typeof schema>;
  profile: { id: string; full_name: string | null };
  subject: string; html: string; text: string | null; fromName: string; fromEmail: string;
  files: GmailAttachment[]; resendFiles: Array<{ filename: string; content: string }>;
};

/**
 * Companies source: one email per founder, each filled with that company's own numbers.
 * iCapOS channel keeps ONE campaign (so Analytics shows the send as a whole) and logs a
 * marketing_event per founder; Gmail sends from the staff member's own inbox.
 */
async function sendToFounders(x: FounderSend): Promise<Response> {
  const { d, profile, subject, html, text, fromName, fromEmail, files, resendFiles } = x;
  if (!subject && !html) return NextResponse.json({ error: "Pick a template or write a subject/body first." }, { status: 400 });
  const channel = d.channel ?? "icapos";
  const { recipients, skippedNoEmail, skippedInternal } = await resolveCompanyRecipients(d.ids ?? []);
  if (recipients.length === 0) {
    return NextResponse.json({ error: skippedInternal > 0 && skippedNoEmail === 0 ? "Demo and internal accounts don't receive real email." : "None of the selected companies have a founder with an email address." }, { status: 400 });
  }
  if (channel === "gmail" && recipients.length > GMAIL_DAILY_LIMIT) {
    return NextResponse.json({ error: `${recipients.length.toLocaleString()} founders exceeds the Gmail daily limit (~${GMAIL_DAILY_LIMIT}). Use iCapOS Email for a send this size, or reduce the selection.` }, { status: 400 });
  }
  if (channel === "icapos") {
    if (!marketingSendEnabled()) return NextResponse.json({ error: "Marketing sending is disabled (MARKETING_SEND_LIVE=false). No email was sent." }, { status: 400 });
    if (!emailConfigured()) return NextResponse.json({ error: "Email provider not configured (RESEND_API_KEY)." }, { status: 400 });
  }

  const day = new Date().toISOString().slice(0, 10);
  const contactIds = await upsertFounderContacts(recipients.map((r) => ({ email: r.email, first_name: r.first_name, last_name: r.last_name, company: r.companyName || null })));
  let campaignId: string | null = null;
  if (channel === "icapos") {
    const listId = await createHiddenList([...contactIds.values()], `(Email) ${(subject || "Untitled").slice(0, 60)} · ${day}`);
    const campaign = await createCampaign({
      name: `Email · ${(subject || "Untitled").slice(0, 60)} · ${day}`,
      list_id: listId, template_id: d.templateId ?? null, from_name: fromName, from_email: fromEmail, reply_to: d.replyTo ?? null,
      subject_override: subject || null, body_override: html || null, status: "draft",
    }, profile.id);
    campaignId = campaign.id;
    await updateCampaignStatus(campaign.id, "sending");
  }
  const db = await marketingDb();

  let sent = 0, skipped = 0, failed = 0;
  for (const rcpt of recipients) {
    if (await isUnsubscribed(rcpt.email)) { skipped++; continue; }
    const fm = await founderVars(rcpt.companyId, { first_name: rcpt.first_name ?? "there", last_name: rcpt.last_name ?? "", company: rcpt.companyName, email: rcpt.email, sender_name: fromName });
    // Without the company's numbers the email would go out with blank tags: hold it back.
    if (!fm) { skipped++; continue; }
    const subjOut = interpolate(fillGlance(subject, fm.vars), fm.vars);
    const htmlOut = interpolate(fillGlance(html, fm.vars), fm.vars);
    if (channel === "gmail") {
      const r = await sendViaGmail({ userId: profile.id, to: rcpt.email, subject: subjOut, body: htmlToText(htmlOut), html: htmlOut, attachments: files });
      if ("error" in r) failed++; else sent++;
      await new Promise((res) => setTimeout(res, 120));
      continue;
    }
    const r = await sendMarketingEmail({
      to: rcpt.email, first_name: rcpt.first_name, last_name: rcpt.last_name, company: rcpt.companyName || null,
      from_name: fromName, from_email: fromEmail, reply_to: d.replyTo ?? null,
      subject: subjOut, html_body: htmlOut, text_body: text, unsubscribe_token: makeUnsubscribeToken(rcpt.email), attachments: resendFiles,
    });
    const contactId = contactIds.get(rcpt.email);
    if (campaignId && contactId) {
      await db.from("marketing_events").insert({
        campaign_id: campaignId, contact_id: contactId, email: rcpt.email, resend_id: r.resend_id,
        event_type: r.ok ? "sent" : "failed", metadata: r.error ? { error: r.error } : {},
      });
    }
    if (r.ok) sent++; else failed++;
    await new Promise((res) => setTimeout(res, 200));
  }

  if (campaignId) {
    // Every send failed (for example the sender domain isn't verified): pause it so it shows and can be retried.
    await db.from("marketing_campaigns").update({ status: sent === 0 && failed > 0 ? "paused" : "sent", sent_at: sent > 0 ? new Date().toISOString() : null, stat_sent: sent }).eq("id", campaignId);
  }
  const emails = recipients.map((r) => r.email);
  after(() => logOutboundEmailActivity(emails, subject || "(no subject)", profile.id, 1000));
  return NextResponse.json({ ok: true, channel, campaignId, sent, skipped, failed, skippedNoEmail, skippedInternal });
}
