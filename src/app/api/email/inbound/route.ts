import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { recordInboundMessage } from "@/lib/email/inbox";
import { pickField, extractReplyToken, parseFromHeader, type InboundPayload } from "@/lib/email/inbound-parse";

/**
 * POST /api/email/inbound — inbound email webhook (provider-agnostic).
 *
 * Configure your inbound provider (Resend Inbound, SendGrid/Mailgun parse, etc.)
 * to POST here. We route by the reply+<token>@domain address the outbound message
 * set as Reply-To. Optionally guard with INBOUND_WEBHOOK_SECRET via ?key= or the
 * x-webhook-secret header.
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

export async function POST(req: NextRequest): Promise<Response> {
  const secret = process.env.INBOUND_WEBHOOK_SECRET;
  if (secret) {
    const provided = req.nextUrl.searchParams.get("key") ?? req.headers.get("x-webhook-secret");
    if (provided !== secret) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
  }

  const payload = await parseBody(req);
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
