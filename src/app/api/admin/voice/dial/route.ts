import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { requireRole } from "@/lib/supabase/auth";
import { voiceOutboundEnabled, preDialGate } from "@/lib/voice/gate";
import { placeVapiCall, vapiConfigured, VAPI_TEST_NUMBER } from "@/lib/voice/vapi";

export const dynamic = "force-dynamic";

// Trigger an outbound call through Vapi. Admin-only. Two guarded modes:
//  - test:    dials ONLY the pre-set VAPI_TEST_NUMBER (your own verified cell).
//  - contact: dials a real contact ONLY if pre_dial_gate() returns eligible.
// Nothing here can dial an arbitrary number.

const bodySchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("test") }),
  z.object({ mode: z.literal("contact"), contactId: z.string().min(1) }),
]);

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Only admins can place calls." }, { status: 403 });
  if (!voiceOutboundEnabled()) return NextResponse.json({ error: "Voice outbound is disabled (VOICE_OUTBOUND_ENABLED)." }, { status: 503 });
  if (!vapiConfigured()) return NextResponse.json({ error: "Vapi is not configured. Set VAPI_API_KEY, VAPI_PHONE_NUMBER_ID, VAPI_ASSISTANT_ID." }, { status: 400 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    if (parsed.data.mode === "test") {
      if (!VAPI_TEST_NUMBER) return NextResponse.json({ error: "Set VAPI_TEST_NUMBER (your own cell in +1 format) to place a test call." }, { status: 400 });
      const { callId } = await placeVapiCall(VAPI_TEST_NUMBER);
      return NextResponse.json({ ok: true, callId, dialed: VAPI_TEST_NUMBER });
    }

    // Real contact — must pass the compliance gate first.
    const gate = await preDialGate(parsed.data.contactId);
    if (!gate.eligible || !gate.phone) {
      return NextResponse.json({ error: `Blocked by gate: ${gate.reason}` }, { status: 409 });
    }
    const { callId } = await placeVapiCall(gate.phone);
    return NextResponse.json({ ok: true, callId, dialed: gate.phone });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Call failed." }, { status: 500 });
  }
}
