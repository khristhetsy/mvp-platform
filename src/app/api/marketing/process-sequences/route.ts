import { NextRequest, NextResponse } from "next/server";
import { processDueSequenceSteps } from "@/lib/marketing/sequences";

// Called by a Vercel cron job every 15 minutes:
// vercel.json: { "crons": [{ "path": "/api/marketing/process-sequences", "schedule": "*/15 * * * *" }] }

export async function GET(req: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const { processed } = await processDueSequenceSteps();
  return NextResponse.json({ ok: true, processed });
}
