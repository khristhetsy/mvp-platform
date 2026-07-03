import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requireRole } from "@/lib/supabase/auth";
import { getSource, listSources } from "@/lib/crm-connectors/registry";
import { countMirror, getSyncState, recentContacts } from "@/lib/crm-connectors/mirror";
import { importBatch } from "@/lib/crm-connectors/sync-engine";

export const dynamic = "force-dynamic";

/** GET — connector status for the admin panel (admin/analyst, read-only). */
export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const sources = await Promise.all(
      listSources().map(async (s) => {
        const [state, counts, recent, test] = await Promise.all([
          getSyncState(s.id),
          countMirror(s.id),
          recentContacts(s.id, 6),
          s.configured ? getSource(s.id)!.test().catch(() => ({ ok: false, count: 0 })) : Promise.resolve(null),
        ]);
        return { ...s, state, counts, recent, test };
      }),
    );
    return NextResponse.json({ sources });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to load connector status." }, { status: 500 });
  }
}

/** POST — run one bounded import batch for a source (admin only). Client loops until done. */
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { source?: string; restart?: boolean };
  if (!body.source) return NextResponse.json({ error: "source required" }, { status: 400 });

  try {
    const result = await importBatch(body.source, { restart: body.restart });
    return NextResponse.json(result);
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Import failed." }, { status: 500 });
  }
}
