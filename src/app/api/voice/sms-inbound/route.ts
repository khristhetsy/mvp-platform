import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { optOutByNumber } from "@/lib/voice/messaging";

export const dynamic = "force-dynamic";

// Inbound SMS/WhatsApp webhook (Twilio). Twilio auto-honors STOP at the carrier,
// but we also record it: any STOP-class keyword adds the number to the DNC list
// and revokes consent across every channel. Auth is a shared secret in the URL
// query (`?s=VOICE_AGENT_SECRET`) since Twilio can't send custom headers.

const STOP_WORDS = new Set(["stop", "stopall", "unsubscribe", "cancel", "end", "quit", "stop all", "remove"]);
const TWIML_EMPTY = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

export async function POST(req: NextRequest): Promise<Response> {
  const secret = process.env.VOICE_AGENT_SECRET?.trim();
  if (secret && req.nextUrl.searchParams.get("s") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const form = await req.formData();
    const from = String(form.get("From") ?? "").replace(/^whatsapp:/, "").trim();
    const body = String(form.get("Body") ?? "").trim().toLowerCase();
    if (from && STOP_WORDS.has(body)) {
      await optOutByNumber(from);
    }
  } catch (err) {
    Sentry.captureException(err);
  }
  // Always 200 with valid (empty) TwiML so Twilio doesn't retry.
  return new NextResponse(TWIML_EMPTY, { headers: { "Content-Type": "text/xml" } });
}
