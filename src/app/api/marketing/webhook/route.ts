import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { marketingDb } from "@/lib/marketing/db";

// Verify a Resend (Svix) webhook signature. The signed content is
// `${id}.${timestamp}.${rawBody}`, HMAC-SHA256'd with the base64 secret that
// follows the `whsec_` prefix; `svix-signature` is a space-separated list of
// `v1,<base64sig>` entries. See https://docs.svix.com/receiving/verifying-payloads.
function verifySvixSignature(secret: string, id: string, timestamp: string, signature: string, rawBody: string): boolean {
  if (!id || !timestamp || !signature) return false;
  // Reject stale deliveries (>5 min skew) to blunt replay attacks.
  const ts = Number(timestamp);
  if (Number.isFinite(ts) && Math.abs(Math.floor(Date.now() / 1000) - ts) > 60 * 5) return false;
  const key = secret.startsWith("whsec_") ? Buffer.from(secret.slice(6), "base64") : Buffer.from(secret, "utf8");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest("base64");
  const expectedBuf = Buffer.from(expected);
  return signature.split(" ").some((part) => {
    const sig = part.split(",")[1];
    if (!sig) return false;
    const sigBuf = Buffer.from(sig);
    return sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf);
  });
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
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }
  // Read the raw body — the signature is computed over the exact bytes.
  const rawBody = await req.text();
  const svixId = req.headers.get("svix-id") ?? "";
  const svixTimestamp = req.headers.get("svix-timestamp") ?? "";
  const svixSignature = req.headers.get("svix-signature") ?? "";
  if (!verifySvixSignature(webhookSecret, svixId, svixTimestamp, svixSignature, rawBody)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let event: ResendWebhookEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const db = await marketingDb();
  const email = event.data.to?.[0];
  const resendId = event.data.email_id;

  if (!email || !resendId) return NextResponse.json({ ok: true });

  const eventTypeMap: Record<string, string> = {
    "email.sent": "sent",
    "email.delivered": "delivered",
    "email.opened": "opened",
    "email.clicked": "clicked",
    "email.bounced": "bounced",
    "email.spam_complaint": "spam_complaint",
    "email.unsubscribed": "unsubscribed",
  };

  const ourEventType = eventTypeMap[event.type];
  if (!ourEventType) return NextResponse.json({ ok: true });

  const { data: originalEvent } = await db
    .from("marketing_events")
    .select("campaign_id, sequence_id, step_id, contact_id, email")
    .eq("resend_id", resendId)
    .maybeSingle();

  if (!originalEvent) return NextResponse.json({ ok: true });

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

  return NextResponse.json({ ok: true });
}
