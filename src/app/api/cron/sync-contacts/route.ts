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
import { rebuildMatchIndex } from "@/lib/fit/match-index";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
    // The /fit match index is derived from crm_contacts, so refresh it here rather than
    // on its own schedule — it can only be stale if contacts changed. Best-effort: a
    // failed rebuild leaves the previous index serving and must not fail the sync.
    const index = await rebuildMatchIndex().catch((err) => {
      Sentry.captureException(err);
      return { scanned: 0, written: 0, removed: 0, error: true };
    });
    return NextResponse.json({ ok: true, sources: sources.length, results, index });
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
