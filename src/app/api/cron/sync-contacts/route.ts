import { NextResponse } from "next/server";
import { withCronGate } from "@/lib/cron/gate";
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
import { applyStageDerivation } from "@/lib/investors/derive-from-type";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DERIVE_BUDGET_MS = 25_000;

async function deriveWithinBudget(budgetMs: number) {
  const started = Date.now();
  const total = { scanned: 0, contacts: 0, fields: 0, errors: 0, firstError: null as string | null, reindexed: 0, done: false };
  let afterId: string | null = null;
  for (let pass = 0; pass < 50; pass++) {
    const d = await applyStageDerivation({ afterId });
    total.scanned += d.scanned; total.contacts += d.contacts; total.fields += d.fields;
    total.errors += d.errors; total.reindexed += d.reindexed;
    total.firstError ??= d.firstError;
    if (d.done) { total.done = true; break; }
    if (!d.nextCursor || d.nextCursor === afterId) break;   // no forward progress — don't spin
    if (Date.now() - started > budgetMs) break;
    afterId = d.nextCursor;
  }
  return total;
}

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
    // Fill operating stage from investor type for anything newly synced. Deterministic,
    // free, and it never overwrites a stated stage — without this, every investor Odoo
    // sends tomorrow arrives with the 25-point stage weight empty and stays that way.
    // Runs BEFORE the index rebuild so the derived values are picked up by it.
    // applyStageDerivation caps one call at 400 contacts and hands back a cursor; a single
    // call after a big Odoo import left the rest unfilled until the next hour. Walk the
    // cursor until done or the budget is spent — the rebuild still needs its share of
    // the 60s, and what's left simply resumes next run.
    const derived = await deriveWithinBudget(DERIVE_BUDGET_MS).catch((err) => {
      Sentry.captureException(err);
      return { scanned: 0, contacts: 0, fields: 0, errors: 1, firstError: "derivation failed", reindexed: 0, done: false };
    });
    // The /fit match index is derived from crm_contacts, so refresh it here rather than
    // on its own schedule — it can only be stale if contacts changed. Best-effort: a
    // failed rebuild leaves the previous index serving and must not fail the sync.
    const index = await rebuildMatchIndex().catch((err) => {
      Sentry.captureException(err);
      return { scanned: 0, written: 0, removed: 0, error: true };
    });
    return NextResponse.json({ ok: true, sources: sources.length, results, derived, index });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ ok: false, error: "Sync failed." }, { status: 500 });
  }
}

async function scheduledGET(request: Request) {
  return handle(request);
}
export async function POST(request: Request) {
  return handle(request);
}

// Pause switch and run log: Admin, System, Scheduled jobs.
export const GET = withCronGate("/api/cron/sync-contacts", scheduledGET);
