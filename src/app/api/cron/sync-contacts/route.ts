import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import {
  cronMisconfiguredResponse,
  cronUnauthorizedResponse,
  getCronSecret,
  validateCronSecret,
} from "@/lib/notifications/cron/auth";
import { configuredSources } from "@/lib/crm-connectors/registry";
import { syncDelta } from "@/lib/crm-connectors/sync-engine";

export const dynamic = "force-dynamic";

// Incremental contact sync — pulls records changed in each configured source
// since its last run and upserts them into the mirror. Gated by CRON_SECRET.
async function handle(request: Request) {
  if (!getCronSecret()) return cronMisconfiguredResponse();
  if (!validateCronSecret(request)) return cronUnauthorizedResponse();

  try {
    const sources = configuredSources();
    const results: Record<string, number> = {};
    for (const s of sources) {
      const { synced } = await syncDelta(s.id).catch((err) => {
        Sentry.captureException(err);
        return { synced: 0 };
      });
      results[s.id] = synced;
    }
    return NextResponse.json({ ok: true, sources: sources.length, results });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ ok: false, error: "Sync failed." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}
export async function POST(request: Request) {
  return handle(request);
}
