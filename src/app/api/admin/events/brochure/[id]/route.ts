import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requirePermissionApi } from "@/lib/api/permissions";
import { getEdition, updateEdition, deleteEdition, editionTitlesForEvent } from "@/lib/event-hub/brochure/editions";
import { isTitleTaken, nextAvailableTitle, validateTitle } from "@/lib/event-hub/brochure/naming";
import type { BrochurePage, BrochureSize, BrochureTheme } from "@/lib/event-hub/brochure/types";

export const dynamic = "force-dynamic";

/** Fetch one edition. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const edition = await getEdition(auth.supabase, id);
    if (!edition) return NextResponse.json({ error: "Edition not found." }, { status: 404 });
    return NextResponse.json({ edition });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Couldn't load the edition." }, { status: 500 });
  }
}

/** Update page_config / overrides / size / title. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as {
      title?: string; pageConfig?: BrochurePage[]; overrides?: Record<string, Record<string, string>>; size?: BrochureSize; theme?: BrochureTheme;
    };
    // Renaming is the one field that can collide. Checked against the same
    // rules the create dialog uses, ignoring this booklet so saving an
    // unchanged name doesn't clash with itself.
    if (body.title !== undefined) {
      const invalid = validateTitle(body.title);
      if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

      const current = await getEdition(auth.supabase, id);
      if (!current) return NextResponse.json({ error: "Edition not found." }, { status: 404 });
      if (current.eventId) {
        const existing = await editionTitlesForEvent(auth.supabase, current.eventId);
        if (isTitleTaken(body.title, existing, id)) {
          return NextResponse.json(
            {
              error: `A booklet for this event is already called “${body.title.trim()}”.`,
              suggestion: nextAvailableTitle(body.title, existing, id),
            },
            { status: 409 },
          );
        }
      }
    }

    const edition = await updateEdition(auth.supabase, id, body);
    return NextResponse.json({ edition });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Couldn't save the edition." }, { status: 500 });
  }
}

/** Permanently delete an edition (and its stored PDFs). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    await deleteEdition(auth.supabase, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Couldn't delete the edition." }, { status: 500 });
  }
}
