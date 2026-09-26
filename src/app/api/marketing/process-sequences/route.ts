import { NextRequest, NextResponse } from "next/server";
import { withCronGate } from "@/lib/cron/gate";
import { collectDueSequenceBatches } from "@/lib/marketing/sequences";

// Called by a Vercel cron job every 15 minutes. GATED: this no longer sends —
// it collects due contacts into pending batches for a human to review & release.
// vercel.json: { "crons": [{ "path": "/api/marketing/process-sequences", "schedule": "*/15 * * * *" }] }

async function scheduledGET(req: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "Misconfigured" }, { status: 503 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { batches, queued } = await collectDueSequenceBatches();
  return NextResponse.json({ ok: true, batches, queued });
}

// Pause switch and run log: Admin, System, Scheduled jobs.
export const GET = withCronGate("/api/marketing/process-sequences", scheduledGET);
