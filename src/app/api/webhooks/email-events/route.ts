import { NextResponse } from "next/server";
import { recordEmailOpen, recordEmailClick } from "@/lib/outreach/email-events";

export const dynamic = "force-dynamic";

/**
 * Email provider (Resend) event webhook. We act on `email.opened` to mark
 * outreach recipients as opened. Secured by a shared secret passed as
 * ?secret=<RESEND_WEBHOOK_SECRET> or the x-webhook-secret header. Fails closed
 * when the secret env is unset.
 */

function collectEmails(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === "string") return value.match(/[^\s<>"]+@[^\s<>"]+/g) ?? [];
  if (Array.isArray(value)) return value.flatMap(collectEmails);
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return collectEmails(obj.address ?? obj.email ?? obj.value ?? "");
  }
  return [];
}

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const provided =
    new URL(request.url).searchParams.get("secret") ?? request.headers.get("x-webhook-secret") ?? "";
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!payload) return NextResponse.json({ error: "Invalid payload." }, { status: 400 });

  const type = typeof payload.type === "string" ? payload.type : "";
  if (type !== "email.opened" && type !== "email.clicked") {
    // Acknowledge other events (delivered, bounced, etc.) without acting on them.
    return NextResponse.json({ ok: true, ignored: type || "unknown" });
  }

  const data = (payload.data as Record<string, unknown>) ?? {};
  const toEmails = [...collectEmails(data.to), ...collectEmails(payload.to)];
  const { marked } =
    type === "email.clicked" ? await recordEmailClick(toEmails) : await recordEmailOpen(toEmails);

  return NextResponse.json({ ok: true, marked });
}
