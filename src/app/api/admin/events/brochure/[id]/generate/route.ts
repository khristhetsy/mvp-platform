import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requirePermissionApi } from "@/lib/api/permissions";
import { getEdition, markGenerated } from "@/lib/event-hub/brochure/editions";
import { loadEventMergeData } from "@/lib/event-email/merge";

export const dynamic = "force-dynamic";
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com";

/** Freeze the merge snapshot and mark the edition generated. The PDF export
 *  (Playwright → print/digital PDFs + cover thumb) lands in the next pass; this
 *  records the edition + snapshot so the library and re-pull flow work now. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const edition = await getEdition(auth.supabase, id);
    if (!edition) return NextResponse.json({ error: "Edition not found." }, { status: 404 });
    const merge = await loadEventMergeData(auth.supabase, edition.eventId, { baseUrl: BASE_URL, campaignId: `brochure-${id}` });
    if (!merge) return NextResponse.json({ error: "Couldn't build merge data." }, { status: 500 });
    const updated = await markGenerated(auth.supabase, id, merge);
    return NextResponse.json({ edition: updated });
  } catch (err) {
    Sentry.captureException(err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Couldn't generate. ${detail.slice(0, 200)}` }, { status: 500 });
  }
}
