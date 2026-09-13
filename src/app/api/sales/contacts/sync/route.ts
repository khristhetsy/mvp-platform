/**
 * POST /api/sales/contacts/sync — "Import from Odoo" in the Contacts gear menu: run the
 * same incremental pull the hourly cron runs, now. Staff-only; bounded by the connector's
 * own delta logic, so a click can't re-import the whole book.
 */
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requireRole } from "@/lib/supabase/auth";
import { configuredSources } from "@/lib/crm-connectors/registry";
import { syncDelta } from "@/lib/crm-connectors/sync-engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const sources = configuredSources();
  if (sources.length === 0) return NextResponse.json({ error: "No CRM source is configured." }, { status: 400 });
  const results: Record<string, number> = {};
  for (const s of sources) {
    try { results[s.id] = (await syncDelta(s.id)).synced; }
    catch (err) { Sentry.captureException(err); results[s.id] = -1; }
  }
  const synced = Object.values(results).filter((n) => n >= 0).reduce((a, b) => a + b, 0);
  const failed = Object.values(results).filter((n) => n < 0).length;
  return NextResponse.json({ ok: failed === 0, synced, failed, results });
}
