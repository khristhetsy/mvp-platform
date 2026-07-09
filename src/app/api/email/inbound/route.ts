import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { recordInboundMessage } from "@/lib/email/inbox";
import { pickField, extractReplyToken, parseFromHeader, type InboundPayload } from "@/lib/email/inbound-parse";
import { getResendApiKey } from "@/lib/env";

/**
 * POST /api/email/inbound — inbound email webhook (provider-agnostic).
 *
 * Supports two shapes:
 *   1. Resend `email.received` events — metadata only; we fetch the body from the
 *      Resend Received Emails API (GET /emails/receiving/{id}).
 *   2. Generic providers (SendGrid/Mailgun parse) that POST the full email.
 *
 * Routes by the reply+<token>@domain address the outbound message set as Reply-To.
 * Guard with INBOUND_WEBHOOK_SECRET — register the webhook URL with `?key=<secret>`
 * (Resend POSTs to the exact URL you configure, query string included).
 */

async function parseBody(req: NextRequest): Promise<InboundPayload> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    return (await req.json().catch(() => ({}))) as InboundPayload;
  }
  try {
    const form = await req.formData();
    const obj: InboundPayload = {};
    for (const [k, v] of form.entries()) obj[k] = typeof v === "string" ? v : "";
    return obj;
  } catch {
    return {};
  }
}

type ReceivedEmail = {
  id: string;
  to?: string[];
  cc?: string[];
  from?: string;
  subject?: string | null;
  text?: string | null;
  html?: string | null;
  headers?: { from?: string } | null;
};

/** Fetch the full received email body from Resend. */
async function fetchResendReceived(emailId: string): Promise<ReceivedEmail | null> {
  const key = getResendApiKey();
  if (!key) return null;
  const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as ReceivedEmail;
}

/** First reply token found across the recipient addresses. */
function tokenFromRecipients(addresses: string[]): string | null {
  for (const a of addresses) {
    const t = extractReplyToken(a);
    if (t) return t;
  }
  return null;
}

export async function POST(req: NextRequest): Promise<Response> {
  // Fail closed: an unset secret must never leave this service-role write path open.
  const secret = process.env.INBOUND_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Inbound webhook not configured." }, { status: 503 });
  }
  const provided = req.nextUrl.searchParams.get("key") ?? req.headers.get("x-webhook-secret");
  if (provided !== secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const payload = await parseBody(req);

  // ── Resend `email.received` event ──────────────────────────────────────────
  if (payload && (payload as { type?: string }).type === "email.received") {
    const data = (payload as { data?: { email_id?: string } }).data ?? {};
    if (!data.email_id) return NextResponse.json({ ignored: true, reason: "no email_id" });

    const email = await fetchResendReceived(data.email_id);
    if (!email) return NextResponse.json({ ignored: true, reason: "could not retrieve body" });

    const recipients = [...(email.to ?? []), ...(email.cc ?? [])];
    const token = tokenFromRecipients(recipients);
    if (!token) return NextResponse.json({ ignored: true, reason: "no reply token" });

    const { email: fromEmail, name } = parseFromHeader(email.headers?.from ?? email.from ?? "");
    if (!fromEmail) return NextResponse.json({ ignored: true, reason: "no sender" });

    const result = await recordInboundMessage(createServiceRoleClient(), {
      token,
      fromEmail,
      fromName: name,
      subject: email.subject ?? null,
      text: email.text ?? null,
      html: email.html ?? null,
    });
    return NextResponse.json({ matched: result.matched });
  }

  // ── Generic provider (full email in the POST) ──────────────────────────────
  const to = pickField(payload, "to", "recipient", "To", "envelope_to");
  const token = extractReplyToken(to);
  if (!token) {
    return NextResponse.json({ ignored: true, reason: "no reply token" });
  }

  const from = pickField(payload, "from", "sender", "From");
  const { email, name } = parseFromHeader(from);
  if (!email) {
    return NextResponse.json({ ignored: true, reason: "no sender" });
  }

  const result = await recordInboundMessage(createServiceRoleClient(), {
    token,
    fromEmail: email,
    fromName: name,
    subject: pickField(payload, "subject", "Subject") || null,
    text: pickField(payload, "text", "body-plain", "plain", "TextBody", "stripped-text") || null,
    html: pickField(payload, "html", "body-html", "HtmlBody") || null,
  });

  return NextResponse.json({ matched: result.matched });
}
