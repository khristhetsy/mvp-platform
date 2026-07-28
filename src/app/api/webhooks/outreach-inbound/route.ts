import { NextResponse } from "next/server";
import {
  handleInboundReply,
  parseReplyRecipientId,
  resolveReplyForward,
} from "@/lib/outreach/manual-outreach";
import { sendEmail } from "@/lib/email/send-email";

export const dynamic = "force-dynamic";

/**
 * Inbound reply webhook for manual outreach. An email provider's inbound route
 * (e.g. Resend Inbound) posts replies here. We stop the recipient's remaining
 * sequence steps (when stop-on-reply is on) and forward the reply to the founder
 * so they never lose it.
 *
 * Secured by a shared secret: the provider must call
 *   /api/webhooks/outreach-inbound?secret=<OUTREACH_INBOUND_SECRET>
 * or send it as the x-webhook-secret header. Fails closed if the env is unset.
 */

function collectEmails(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === "string") {
    const m = value.match(/[^\s<>"]+@[^\s<>"]+/g);
    return m ?? [];
  }
  if (Array.isArray(value)) return value.flatMap(collectEmails);
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return collectEmails(obj.address ?? obj.email ?? obj.value ?? "");
  }
  return [];
}

function firstString(...vals: unknown[]): string {
  for (const v of vals) if (typeof v === "string" && v.trim()) return v;
  return "";
}

export async function POST(request: Request) {
  const secret = process.env.OUTREACH_INBOUND_SECRET;
  const provided =
    new URL(request.url).searchParams.get("secret") ?? request.headers.get("x-webhook-secret") ?? "";
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!payload) return NextResponse.json({ error: "Invalid payload." }, { status: 400 });

  // Providers nest the message differently; look in a few common places.
  const data = (payload.data as Record<string, unknown>) ?? payload;
  const toEmails = [...collectEmails(data.to), ...collectEmails(payload.to)];
  const fromEmails = [...collectEmails(data.from), ...collectEmails(payload.from)];

  const recipientId = toEmails.map(parseReplyRecipientId).find((id): id is string => Boolean(id)) ?? null;
  const fromEmail = fromEmails[0] ?? null;

  const { stopped } = await handleInboundReply({ recipientId, fromEmail });

  // Forward the reply to the founder (best-effort; requires the recipient token).
  if (recipientId) {
    try {
      const fwd = await resolveReplyForward(recipientId);
      if (fwd) {
        const subject = firstString(data.subject, payload.subject) || "Investor reply";
        const bodyText = firstString(data.text, payload.text, data.html, payload.html) || "(no message body)";
        const from = fwd.investorName ?? fromEmail ?? "an investor";
        await sendEmail({
          to: fwd.founderEmail,
          replyTo: fromEmail ?? undefined,
          subject: `Reply from ${from}: ${subject}`,
          html: `<p><strong>${from}</strong> replied to your outreach${fwd.companyName ? ` for ${fwd.companyName}` : ""}. Their sequence has been stopped.</p><hr/><div style="white-space:pre-wrap">${bodyText.replace(/[<>]/g, "")}</div>`,
          text: `${from} replied to your outreach. Their sequence has been stopped.\n\n${bodyText}`,
        });
      }
    } catch {
      // Forwarding is best-effort — the stop already happened.
    }
  }

  return NextResponse.json({ ok: true, stopped });
}
