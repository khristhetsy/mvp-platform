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
 *
 * Staff-only.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { applyContactFilters } from "@/lib/sales/contact-filters";
import { oppIdsToCrmIds, crmIdsToMarketingContacts, createHiddenList } from "@/lib/marketing/selection";
import { getTemplate } from "@/lib/marketing/templates";
import { createCampaign, sendCampaign } from "@/lib/marketing/campaigns";
import { enrollList } from "@/lib/marketing/sequences";
import { sendMarketingEmail, makeUnsubscribeToken, interpolate, htmlToText, emailConfigured } from "@/lib/marketing/send";
import { isUnsubscribed } from "@/lib/marketing/contacts";
import { sendViaGmail } from "@/lib/integrations/gmail-send";

export const dynamic = "force-dynamic";

// Conservative Gmail daily cap — Workspace allows ~500 external/day (less on consumer
// accounts). Above this we refuse and steer to iCapOS rather than risk a block.
const GMAIL_DAILY_LIMIT = 450;
const GROUPS = ["founder", "investor", "advisor", "other"];
const MAX_TARGET = 25000;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const schema = z.object({
  source: z.enum(["contacts", "opportunities"]),
  mode: z.enum(["ids", "filter"]),
  ids: z.array(z.string().uuid()).max(MAX_TARGET).optional(),
  params: z.string().max(4000).optional(),
  group: z.string().max(40).optional(),
  action: z.enum(["send", "test", "sequence"]),
  channel: z.enum(["icapos", "gmail"]).optional(),
  templateId: z.string().uuid().nullish(),
  subject: z.string().max(300).nullish(),
  html: z.string().max(100000).nullish(),
  fromName: z.string().max(120).nullish(),
  fromEmail: z.string().max(200).nullish(),
  replyTo: z.string().max(200).nullish(),
  testEmail: z.string().max(200).nullish(),
  sequenceId: z.string().uuid().nullish(),
});

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const d = parsed.data;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = serviceRoleClientUntyped();

  // ── Resolve the selection to crm_contacts ids ──────────────────────────────
  let crmIds: string[] = [];
  if (d.source === "opportunities") {
    crmIds = await oppIdsToCrmIds([...new Set(d.ids ?? [])]);
  } else if (d.mode === "ids") {
    crmIds = [...new Set(d.ids ?? [])];
  } else {
    const p = new URLSearchParams(d.params ?? "");
    const PAGE = 1000;
    for (let from = 0; from < MAX_TARGET; from += PAGE) {
      let q = db.from("crm_contacts").select("id").range(from, from + PAGE - 1);
      if (d.group && GROUPS.includes(d.group)) q = q.or(`contact_type.eq.${d.group},module.eq.${d.group}`);
      q = applyContactFilters(q, p);
      const { data, error } = await q;
      if (error || !data || data.length === 0) break;
      crmIds.push(...(data as { id: string }[]).map((r) => r.id));
      if (data.length < PAGE) break;
    }
    crmIds = [...new Set(crmIds)];
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
    const vars = { first_name: "Spencer", last_name: "Scherer", company: "newf.tech", email: to, sender_name: fromName };
    const subjOut = `[TEST] ${interpolate(subject, vars)}`;
    const htmlOut = interpolate(html, vars);
    if ((d.channel ?? "icapos") === "gmail") {
      const r = await sendViaGmail({ userId: profile.id, to, subject: subjOut, body: htmlToText(htmlOut), html: htmlOut });
      return "error" in r
        ? NextResponse.json({ error: r.error.message }, { status: 400 })
        : NextResponse.json({ ok: true, to });
    }
    if (!emailConfigured()) return NextResponse.json({ error: "Email provider not configured (RESEND_API_KEY)." }, { status: 400 });
    const r = await sendMarketingEmail({ to, first_name: vars.first_name, company: vars.company, from_name: fromName, from_email: fromEmail, reply_to: d.replyTo ?? null, subject: subjOut, html_body: htmlOut, text_body: text, unsubscribe_token: makeUnsubscribeToken(to) });
    return r.ok ? NextResponse.json({ ok: true, to }) : NextResponse.json({ error: r.error ?? "Test send failed." }, { status: 400 });
  }

  if (crmIds.length === 0) return NextResponse.json({ error: "No contacts in the selection." }, { status: 400 });

  const { recipients, skippedNoEmail } = await crmIdsToMarketingContacts(crmIds);
  if (recipients.length === 0) return NextResponse.json({ error: "None of the selected contacts have an email address." }, { status: 400 });

  // ── SEQUENCE: enroll the selection ─────────────────────────────────────────
  if (d.action === "sequence") {
    if (!d.sequenceId) return NextResponse.json({ error: "Pick a sequence." }, { status: 400 });
    const listId = await createHiddenList(recipients.map((r) => r.id), `(Sequence) ${new Date().toISOString().slice(0, 10)}`);
    const { enrolled } = await enrollList(d.sequenceId, listId);
    return NextResponse.json({ ok: true, enrolled, skippedNoEmail });
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
      const r = await sendViaGmail({ userId: profile.id, to: rcpt.email, subject: interpolate(subject, vars), body: htmlToText(htmlOut), html: htmlOut });
      if ("error" in r) failed++; else sent++;
      await new Promise((res) => setTimeout(res, 120));
    }
    return NextResponse.json({ ok: true, channel: "gmail", sent, skipped, failed, skippedNoEmail });
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
    const result = await sendCampaign(campaign.id);
    return NextResponse.json({ ok: true, channel: "icapos", campaignId: campaign.id, ...result, skippedNoEmail });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Send failed." }, { status: 400 });
  }
}
