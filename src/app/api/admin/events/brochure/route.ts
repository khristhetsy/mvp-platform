import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requirePermissionApi } from "@/lib/api/permissions";
import { getEventById } from "@/lib/icfo-events/queries";
import { listEditions, createEdition } from "@/lib/event-hub/brochure/editions";

export const dynamic = "force-dynamic";

/** List brochure editions (optionally for one event). */
export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const eventId = req.nextUrl.searchParams.get("eventId") ?? undefined;
    const editions = await listEditions(auth.supabase, eventId);
    return NextResponse.json({ editions });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Couldn't load editions." }, { status: 500 });
  }
}

/** Create a draft edition. `{ eventId, baseEditionId? }`. */
export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await req.json().catch(() => ({}))) as { eventId?: string; baseEditionId?: string; title?: string };
    if (!body.eventId) return NextResponse.json({ error: "Missing event." }, { status: 400 });
    const event = await getEventById(auth.supabase, body.eventId).catch(() => null);
    if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    const title = body.title?.trim() || `${event.title} — Issue ${new Date().getFullYear()}`;
    const edition = await createEdition(auth.supabase, { eventId: body.eventId, title, baseEditionId: body.baseEditionId, createdBy: auth.userId });
    return NextResponse.json({ edition });
  } catch (err) {
    Sentry.captureException(err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Couldn't create the edition. ${detail.slice(0, 200)}` }, { status: 500 });
  }
}
