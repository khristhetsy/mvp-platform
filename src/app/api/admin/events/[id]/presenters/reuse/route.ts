import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { createPresenter, listEventPresenters } from "@/lib/icfo-events/applications";
import { copyFrom, personKey } from "@/lib/icfo-events/presenter-reuse";
import type { EventPresenter } from "@/lib/icfo-events/types";

export const dynamic = "force-dynamic";

const schema = z.object({
  sourceIds: z.array(z.string().uuid()).min(1).max(50),
  keepBio: z.boolean().default(true),
  keepHeadline: z.boolean().default(false),
});

/**
 * Copy presenters from past events onto this one.
 *
 * The client picks from rows it already has, but the copy is made server-side
 * from a fresh read: a stale client list could otherwise duplicate someone
 * added in another tab, and the fields that travel are decided in one place
 * (`copyFrom`) rather than assembled by whoever calls the endpoint.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id: eventId } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    const { sourceIds, keepBio, keepHeadline } = parsed.data;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = auth.supabase as any;
    const { data, error } = await db
      .from("event_presenters")
      .select("*, events:event_id(title, slug)")
      .in("id", sourceIds);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const sources = (data ?? []) as Record<string, unknown>[];
    if (sources.length === 0) return NextResponse.json({ error: "Nothing to copy." }, { status: 400 });

    // Re-read the target roster so a person already added — in another tab, or
    // twice in one selection — is skipped rather than duplicated.
    const existing = await listEventPresenters(auth.supabase, eventId);
    const taken = new Set(existing.map((p) => personKey(p)));

    const added: EventPresenter[] = [];
    const skipped: string[] = [];

    for (const row of sources) {
      const source = {
        id: String(row.id),
        eventId: String(row.event_id),
        sessionId: null,
        applicationId: null,
        profileId: (row.profile_id as string | null) ?? null,
        displayName: String(row.display_name),
        roleLabel: (row.role_label as string | null) ?? null,
        headshotPath: (row.headshot_path as string | null) ?? null,
        headline: (row.headline as string | null) ?? null,
        bio: (row.bio as string | null) ?? null,
        links: Array.isArray(row.links) ? (row.links as string[]) : [],
        position: 0,
        companySummary: (row.company_summary as string | null) ?? null,
        meetingUrl: null,
        startsAt: null,
        timezone: null,
        email: (row.email as string | null) ?? null,
      } satisfies EventPresenter;

      // Copying someone onto the event they already came from is always a
      // duplicate, whatever the roster says.
      if (source.eventId === eventId || taken.has(personKey(source))) {
        skipped.push(source.displayName);
        continue;
      }

      const copy = copyFrom(source, { keepBio, keepHeadline });
      added.push(await createPresenter(auth.supabase, { eventId, ...copy }));
      taken.add(personKey(source));
    }

    return NextResponse.json({ presenters: added, skipped }, { status: added.length ? 201 : 200 });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to reuse presenters." }, { status: 500 });
  }
}
