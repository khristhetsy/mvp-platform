import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requirePermissionApi } from "@/lib/api/permissions";
import { getEdition } from "@/lib/event-hub/brochure/editions";
import { loadEventMergeData } from "@/lib/event-email/merge";
import { renderEventEmail } from "@/lib/event-email/render";
import { materializeRegistrantList } from "@/lib/event-email/segments";
import { getEventById } from "@/lib/icfo-events/queries";
import { createCampaign } from "@/lib/marketing/campaigns";
import type { MarketingCampaign } from "@/lib/marketing/types";

export const dynamic = "force-dynamic";
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com";

/** Merged-booklet distribute: email the event's registered guests the booklet
 *  (download-CTA email built from the edition), with an optional cover note.
 *  Creates a Marketing campaign (draft, or scheduled) — sending stays in the pipeline. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { coverNote?: string; subject?: string; scheduleAt?: string | null };

    const edition = await getEdition(auth.supabase, id);
    if (!edition) return NextResponse.json({ error: "Edition not found." }, { status: 404 });
    if (!edition.eventId) return NextResponse.json({ error: "This booklet isn't linked to an event." }, { status: 400 });
    if (edition.status !== "generated" || !edition.published || !edition.pdfDigitalPath) {
      return NextResponse.json({ error: "Generate and publish the booklet before emailing guests." }, { status: 400 });
    }

    const event = await getEventById(auth.supabase, edition.eventId).catch(() => null);
    if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });

    const merge = await loadEventMergeData(auth.supabase, edition.eventId, { baseUrl: BASE_URL, campaignId: `booklet-${id}` });
    if (!merge) return NextResponse.json({ error: "Couldn't build merge data." }, { status: 500 });

    const bookletUrl = `${BASE_URL}/events/brochure/${id}`;
    const html = renderEventEmail(merge, { type: "booklet", includeBanner: true, bookletUrl, coverNote: body.coverNote });

    const { listId, count } = await materializeRegistrantList(edition.eventId, event.title, ["registered"]);
    if (count === 0) return NextResponse.json({ error: "No eligible registered guests (after suppression)." }, { status: 400 });

    const input = {
      name: `${event.title} — booklet to guests`,
      list_id: listId,
      template_id: null,
      subject_override: body.subject?.trim() || `Your booklet: ${merge.title}`,
      body_override: html,
      status: body.scheduleAt ? "scheduled" : "draft",
      scheduled_at: body.scheduleAt ?? null,
      event_id: edition.eventId,
      event_email_type: "booklet",
      merge_snapshot: merge,
    } as unknown as Partial<MarketingCampaign>;

    const campaign = await createCampaign(input, auth.userId);
    return NextResponse.json({ campaignId: campaign.id, status: campaign.status, count });
  } catch (err) {
    Sentry.captureException(err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Couldn't create the guest email. ${detail.slice(0, 180)}` }, { status: 500 });
  }
}
