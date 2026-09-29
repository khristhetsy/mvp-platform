import { NextResponse } from "next/server";
import { recordEmailOpen, recordEmailClick } from "@/lib/outreach/email-events";
import { recordEngagement } from "@/lib/ir/sequences";
import { recordEmailLogEvent } from "@/lib/email/email-log";

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
  const data = (payload.data as Record<string, unknown>) ?? {};

  // Every event (delivered, opened, clicked, bounced, complained, delayed)
  // updates the platform email log row for that send (Admin, Activity, Sent).
  const emailId = typeof data.email_id === "string" ? data.email_id : "";
  const logged = emailId
    ? await recordEmailLogEvent({
        providerId: emailId,
        type,
        at: typeof payload.created_at === "string" ? payload.created_at : null,
        to: collectEmails(data.to),
      })
    : 0;

  if (type !== "email.opened" && type !== "email.clicked") {
    return NextResponse.json({ ok: true, logged, ignored: type || "unknown" });
  }

  // IR auto sequence emails carry ir_seq / ir_step tags (object or [{ name, value }]).
  const rawTags = data.tags;
  const tags: Record<string, string> = Array.isArray(rawTags)
    ? Object.fromEntries((rawTags as Array<{ name?: string; value?: string }>).filter((t) => t?.name).map((t) => [String(t.name), String(t.value ?? "")]))
    : rawTags && typeof rawTags === "object" ? Object.fromEntries(Object.entries(rawTags as Record<string, unknown>).map(([k, v]) => [k, String(v)])) : {};
  if (tags.ir_seq) {
    const step = Number.parseInt(tags.ir_step ?? "", 10);
    await recordEngagement(tags.ir_seq, type === "email.clicked" ? "click" : "open", Number.isFinite(step) ? step : null).catch(() => false);
  }
  const toEmails = [...collectEmails(data.to), ...collectEmails(payload.to)];
  const { marked } =
    type === "email.clicked" ? await recordEmailClick(toEmails) : await recordEmailOpen(toEmails);

  return NextResponse.json({ ok: true, marked });
}
