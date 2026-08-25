import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { voiceOutboundEnabled } from "@/lib/voice/gate";
import { runCadenceTick } from "@/lib/voice/cadence";

export const dynamic = "force-dynamic";

// Cron: fire due multichannel cadence steps. Guarded by CRON_SECRET (Vercel cron
// sends it as a Bearer token). No-ops when the master kill-switch is off.
export async function GET(req: NextRequest): Promise<Response> {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!voiceOutboundEnabled()) return NextResponse.json({ skipped: "voice outbound disabled" });
  try {
    const result = await runCadenceTick();
    return NextResponse.json(result);
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Cadence tick failed." }, { status: 500 });
  }
}
