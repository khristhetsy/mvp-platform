import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { withCronGate } from "@/lib/cron/gate";
import { runIntroRequestDigest } from "@/lib/matching/intro-request-digest";

export const dynamic = "force-dynamic";

/**
 * Daily admin digest of founder introduction requests: what came in over the
 * last 24 hours and how many still wait on staff. Reports every skip so a quiet
 * day is explainable.
 */
async function scheduledGET(req: NextRequest): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await runIntroRequestDigest());
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "The intro request digest failed." }, { status: 500 });
  }
}

// Pause switch and run log: Admin, System, Scheduled jobs.
export const GET = withCronGate("/api/cron/intro-request-digest", scheduledGET);
