import { NextRequest, NextResponse } from "next/server";
import { marketingDb } from "@/lib/marketing/db";
import { verifySvixSignature } from "@/lib/marketing/webhook-verify";

type WebhookOutcome = "unconfigured" | "bad_signature" | "bad_json" | "no_match" | "ignored_type" | "recorded";

// Best-effort diagnostics: record every inbound attempt so Analytics can explain
// exactly why tracking isn't flowing. Never throws — logging must not break ingest.
async function logAttempt(outcome: WebhookOutcome, opts: { verified: boolean; eventType?: string | null; detail?: string } = { verified: false }): Promise<void> {
  try {
    await marketingDb().from("marketing_webhook_log").insert({
      outcome,
      verified: opts.verified,
      event_type: opts.eventType ?? null,
      detail: opts.detail ?? null,
    });
  } catch { /* diagnostics are best-effort */ }
}

type ResendWebhookEvent = {
  type:
    | "email.sent"
    | "email.delivered"
    | "email.opened"
    | "email.clicked"
    | "email.bounced"
    | "email.spam_complaint"
    | "email.unsubscribed";
  data: {
    email_id: string;
    to: string[];
    click?: { link: string; userAgent?: string };
    bounce?: { type: string };
  };
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!webhookSecret) {
    await logAttempt("unconfigured", { verified: false, detail: "RESEND_WEBHOOK_SECRET is not set" });
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }
  // Read the raw body — the signature is computed over the exact bytes.
  const rawBody = await req.text();
  const svixId = req.headers.get("svix-id") ?? "";
  const svixTimestamp = req.headers.get("svix-timestamp") ?? "";
  const svixSignature = req.headers.get("svix-signature") ?? "";
  if (!verifySvixSignature(webhookSecret, svixId, svixTimestamp, svixSignature, rawBody)) {
    await logAttempt("bad_signature", { verified: false, detail: "Signature did not match RESEND_WEBHOOK_SECRET" });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let event: ResendWebhookEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    await logAttempt("bad_json", { verified: true });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const db = await marketingDb();
  const email = event.data.to?.[0];
  const resendId = event.data.email_id;

  if (!email || !resendId) {
    await logAttempt("ignored_type", { verified: true, eventType: event.type, detail: "missing to/email_id" });
    return NextResponse.json({ ok: true });
  }

  const eventTypeMap: Record<string, string> = {
    "email.sent": "sent",
    "email.delivered": "delivered",
    "email.opened": "opened",
    "email.clicked": "clicked",
    "email.bounced": "bounced",
    // Resend emits `email.complained` for spam complaints; keep the legacy key too.
    "email.complained": "spam_complaint",
    "email.spam_complaint": "spam_complaint",
    "email.unsubscribed": "unsubscribed",
  };

  const ourEventType = eventTypeMap[event.type];
  if (!ourEventType) {
    await logAttempt("ignored_type", { verified: true, eventType: event.type });
    return NextResponse.json({ ok: true });
  }

  // Find the original send by resend_id. Use limit(1) (NOT maybeSingle) — once any
  // event for this email is recorded there are multiple rows with the same
  // resend_id, and maybeSingle would error on "multiple rows" and drop the event.
  const { data: matches } = await db
    .from("marketing_events")
    .select("campaign_id, sequence_id, step_id, contact_id, email")
    .eq("resend_id", resendId)
    .limit(1);
  const originalEvent = matches?.[0];

  if (!originalEvent) {
    await logAttempt("no_match", { verified: true, eventType: ourEventType, detail: `no sent record for resend_id ${resendId}` });
    return NextResponse.json({ ok: true });
  }

  // Idempotent: skip if this exact event was already recorded (Resend retries).
  const { count: existing } = await db
    .from("marketing_events")
    .select("*", { count: "exact", head: true })
    .eq("resend_id", resendId)
    .eq("event_type", ourEventType);
  if ((existing ?? 0) > 0) {
    await logAttempt("recorded", { verified: true, eventType: ourEventType, detail: "duplicate ignored" });
    return NextResponse.json({ ok: true });
  }

  await db.from("marketing_events").insert({
    campaign_id: originalEvent.campaign_id,
    sequence_id: originalEvent.sequence_id,
    step_id: originalEvent.step_id,
    contact_id: originalEvent.contact_id,
    email: originalEvent.email,
    resend_id: resendId,
    event_type: ourEventType,
    metadata: {
      click_link: event.data.click?.link,
      user_agent: event.data.click?.userAgent,
      bounce_type: event.data.bounce?.type,
    },
  });

  // Update campaign stat counter via RPC (add this to migration if you want atomic increments)
  if (originalEvent.campaign_id && ["delivered", "opened", "clicked", "bounced", "unsubscribed"].includes(ourEventType)) {
    const col = `stat_${ourEventType}`;
    // Increment via raw update (non-atomic but sufficient for MVP)
    const { data: camp } = await db
      .from("marketing_campaigns")
      .select(col)
      .eq("id", originalEvent.campaign_id)
      .single();
    if (camp) {
      const campRow = camp as unknown as Record<string, unknown>;
      await db
        .from("marketing_campaigns")
        .update({ [col]: ((campRow[col] as number) ?? 0) + 1 })
        .eq("id", originalEvent.campaign_id);
    }
  }

  if (["bounced", "spam_complaint", "unsubscribed"].includes(ourEventType)) {
    await db
      .from("marketing_unsubscribes")
      .upsert({ email, reason: ourEventType }, { onConflict: "email" });
  }

  await logAttempt("recorded", { verified: true, eventType: ourEventType });
  return NextResponse.json({ ok: true });
}
