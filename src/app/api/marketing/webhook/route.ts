import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { marketingDb } from "@/lib/marketing/db";

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
  if (webhookSecret) {
    const signature = req.headers.get("svix-signature") ?? "";
    // Constant-time comparison to prevent timing attacks
    try {
      const sigBuf = Buffer.from(signature);
      const secretBuf = Buffer.from(webhookSecret);
      const valid =
        sigBuf.length === secretBuf.length &&
        timingSafeEqual(sigBuf, secretBuf);
      if (!valid) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let event: ResendWebhookEvent;
  try {
    event = await req.json();
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
