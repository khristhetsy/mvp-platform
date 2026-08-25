import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requireRole } from "@/lib/supabase/auth";
import { voiceOutboundEnabled } from "@/lib/voice/gate";
import { vapiConfigured, transferVapiCall, VOICE_TRANSFER_NUMBER } from "@/lib/voice/vapi";
import { upsertLiveCall } from "@/lib/voice/live-calls";

export const dynamic = "force-dynamic";

/** Hot-transfer an in-progress call to the human rep (admin only). Marks the
 *  live call "transferring" and asks the runtime to forward it. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ callId: string }> }): Promise<Response> {
  const profile = await requireRole(["admin"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  if (!voiceOutboundEnabled()) return NextResponse.json({ error: "Voice outbound is disabled." }, { status: 503 });
  if (!vapiConfigured()) return NextResponse.json({ error: "Vapi is not configured." }, { status: 400 });
  if (!VOICE_TRANSFER_NUMBER) return NextResponse.json({ error: "Set VOICE_TRANSFER_NUMBER (the rep's number) to hot-transfer." }, { status: 400 });

  const { callId } = await params;
  try {
    await upsertLiveCall({ callId, status: "transferring" });
    await transferVapiCall(callId, VOICE_TRANSFER_NUMBER);
    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Transfer failed." }, { status: 500 });
  }
}
