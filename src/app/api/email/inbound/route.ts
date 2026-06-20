import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { recordInboundMessage } from "@/lib/email/inbox";

/**
 * POST /api/email/inbound — inbound email webhook (provider-agnostic).
 *
 * Configure your inbound provider (Resend Inbound, SendGrid/Mailgun parse, etc.)
 * to POST here. We route by the reply+<token>@domain address the outbound message
 * set as Reply-To. Optionally guard with INBOUND_WEBHOOK_SECRET via ?key= or the
 * x-webhook-secret header.
 */

type Payload = Record<string, unknown>;

function str(payload: Payload, ...keys: string[]): string {
  for (const k of keys) {
    const v = payload[k];
    if (typeof v === "string" && v.length > 0) return v;
    if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  }
  return "";
}

async function parseBody(req: NextRequest): Promise<Payload> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    return (await req.json().catch(() => ({}))) as Payload;
  }
  try {
    const form = await req.formData();
    const obj: Payload = {};
    for (const [k, v] of form.entries()) obj[k] = typeof v === "string" ? v : "";
    return obj;
  } catch {
    return {};
  }
}

function extractToken(to: string): string | null {
  const m = to.match(/reply\+([a-zA-Z0-9]+)@/i);
  return m ? m[1] : null;
}

function parseFrom(from: string): { email: string; name: string | null } {
  const angle = from.match(/<([^>]+)>/);
  if (angle) {
    const name = from.slice(0, from.indexOf("<")).trim().replace(/^"|"$/g, "");
    return { email: angle[1].trim(), name: name || null };
  }
  return { email: from.trim(), name: null };
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
  const to = str(payload, "to", "recipient", "To", "envelope_to");
  const token = extractToken(to);
  if (!token) {
    return NextResponse.json({ ignored: true, reason: "no reply token" });
  }

  const from = str(payload, "from", "sender", "From");
  const { email, name } = parseFrom(from);
  if (!email) {
    return NextResponse.json({ ignored: true, reason: "no sender" });
  }

  const result = await recordInboundMessage(createServiceRoleClient(), {
    token,
    fromEmail: email,
    fromName: name,
    subject: str(payload, "subject", "Subject") || null,
    text: str(payload, "text", "body-plain", "plain", "TextBody", "stripped-text") || null,
    html: str(payload, "html", "body-html", "HtmlBody") || null,
  });

  return NextResponse.json({ matched: result.matched });
}
