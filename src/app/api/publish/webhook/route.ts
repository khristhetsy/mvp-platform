import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { advanceLeadStatus } from "@/lib/prospects/lead-status";

export const dynamic = "force-dynamic";

// Resend event type → our publish_events.event
const EVENT_MAP: Record<string, "delivered" | "open" | "click" | "bounce" | "unsub"> = {
  "email.delivered": "delivered",
  "email.opened": "open",
  "email.clicked": "click",
  "email.bounced": "bounce",
  "email.complained": "unsub",
};

// POST /api/publish/webhook — Resend delivery events → publish_events, matched by
// the resend id recorded at send time. Public endpoint (called by Resend).
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const payload = (await req.json().catch(() => null)) as { type?: string; data?: { email_id?: string; to?: string[] } } | null;
    const mapped = payload?.type ? EVENT_MAP[payload.type] : undefined;
    const emailId = payload?.data?.email_id;
    if (!mapped || !emailId) return NextResponse.json({ ok: true, ignored: true });

    const db = serviceRoleClientUntyped();
    // Find the original 'sent' row to inherit publish_id + contact_id.
    const { data: origin } = await db
      .from("publish_events")
      .select("publish_id, contact_id, email")
      .eq("resend_id", emailId)
      .eq("event", "sent")
      .limit(1)
      .maybeSingle();

    if (!origin) return NextResponse.json({ ok: true, unmatched: true });

    await db.from("publish_events").insert({
      publish_id: origin.publish_id,
      contact_id: origin.contact_id,
      email: origin.email,
      resend_id: emailId,
      event: mapped,
    });

    // Activity nudge: an open/click moves the lead → engaged (forward-only).
    if ((mapped === "open" || mapped === "click") && origin.contact_id) {
      await advanceLeadStatus(db, origin.contact_id, "engaged");
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ ok: false }, { status: 200 }); // never 500 a webhook
  }
}
