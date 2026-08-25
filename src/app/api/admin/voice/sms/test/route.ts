import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { requireRole } from "@/lib/supabase/auth";
import { voiceOutboundEnabled } from "@/lib/voice/gate";
import { sendTwilioMessage, twilioConfigured, TWILIO_TEST_NUMBER } from "@/lib/voice/twilio";

export const dynamic = "force-dynamic";

// Send a test SMS/WhatsApp to the pre-set TWILIO_TEST_NUMBER only (your own
// verified cell). Admin-only; kill-switch + Twilio-config gated. Nothing here can
// message an arbitrary contact.

const schema = z.object({
  channel: z.enum(["sms", "whatsapp"]).default("sms"),
  body: z.string().min(1).max(600).default("iCapOS Voice — test message. Reply STOP to opt out."),
});

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Only admins can send." }, { status: 403 });
  if (!voiceOutboundEnabled()) return NextResponse.json({ error: "Voice outbound is disabled (VOICE_OUTBOUND_ENABLED)." }, { status: 503 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  if (!twilioConfigured(parsed.data.channel)) return NextResponse.json({ error: `Twilio ${parsed.data.channel} is not configured.` }, { status: 400 });
  if (!TWILIO_TEST_NUMBER) return NextResponse.json({ error: "Set TWILIO_TEST_NUMBER (your own cell in +1 format) to send a test." }, { status: 400 });

  try {
    const { sid } = await sendTwilioMessage(parsed.data.channel, TWILIO_TEST_NUMBER, parsed.data.body);
    return NextResponse.json({ ok: true, sid, to: TWILIO_TEST_NUMBER });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Send failed." }, { status: 500 });
  }
}
