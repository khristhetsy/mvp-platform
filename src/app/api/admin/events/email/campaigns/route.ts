import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requirePermissionApi } from "@/lib/api/permissions";
import { loadEventMergeData, type EventEmailType } from "@/lib/event-email/merge";
import { renderEventEmail } from "@/lib/event-email/render";
import { materializeRegistrantList, type RegistrantStatus } from "@/lib/event-email/segments";
import { getEventById } from "@/lib/icfo-events/queries";
import { createCampaign } from "@/lib/marketing/campaigns";
import type { MarketingCampaign } from "@/lib/marketing/types";

export const dynamic = "force-dynamic";
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com";

/** Create a Marketing Hub campaign from an event email. Stores the rendered HTML
 *  as body_override (no template row needed), tags it to the event, and freezes a
 *  merge_snapshot. Created as draft/scheduled — the actual send stays in Marketing
 *  Hub (existing pipeline). */
export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await req.json().catch(() => ({}))) as {
      eventId?: string;
      type?: EventEmailType;
      includeBanner?: boolean;
      includeLobby?: boolean;
      listId?: string;
      audienceKind?: "list" | "registrants";
      registrantStatuses?: RegistrantStatus[];
      subject?: string;
      scheduleAt?: string | null;
      bookletUrl?: string;
      bookletEditionId?: string;
      bodyHtml?: string;
    };
    const { eventId, type = "invite", subject } = body;
    // Recipient-facing booklet link: prefer an explicit URL, else the public
    // digital-view route for the chosen edition (stable, no signed-URL expiry).
    const bookletUrl =
      body.bookletUrl ||
      (body.bookletEditionId ? `${BASE_URL}/events/brochure/${body.bookletEditionId}` : undefined);
    const audienceKind = body.audienceKind ?? "list";
    if (!eventId) return NextResponse.json({ error: "Missing event." }, { status: 400 });
    if (!subject?.trim()) return NextResponse.json({ error: "Enter a subject line." }, { status: 400 });
    if (audienceKind === "list" && !body.listId) return NextResponse.json({ error: "Choose an audience list." }, { status: 400 });

    const event = await getEventById(auth.supabase, eventId).catch(() => null);
    if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });

    // Resolve the audience to a list_id. Registrants are materialized into a
    // per-event marketing list (suppression honored) so the send pipeline can use it.
    let listId = body.listId ?? null;
    let registrantCount: number | null = null;
    if (audienceKind === "registrants") {
      const statuses = (body.registrantStatuses?.length ? body.registrantStatuses : ["registered"]) as RegistrantStatus[];
      const res = await materializeRegistrantList(eventId, event.title, statuses);
      listId = res.listId;
      registrantCount = res.count;
      if (res.count === 0) return NextResponse.json({ error: "No eligible registrants for the selected statuses (after suppression)." }, { status: 400 });
    }
    if (!listId) return NextResponse.json({ error: "No audience resolved." }, { status: 400 });

    // Guardrail (§9): invite/reminder can't be scheduled after the event has started.
    const sendAt = body.scheduleAt ? Date.parse(body.scheduleAt) : Date.now();
    const startsAt = event.startsAt ? Date.parse(event.startsAt) : null;
    if (type !== "day_of" && type !== "booklet" && startsAt && sendAt >= startsAt) {
      return NextResponse.json(
        { error: "That send time is at or after the event start — use the day-of type, or an earlier time." },
        { status: 400 },
      );
    }

    const merge = await loadEventMergeData(auth.supabase, eventId, { baseUrl: BASE_URL, campaignId: `evt-${eventId}` });
    if (!merge) return NextResponse.json({ error: "Couldn't build merge data." }, { status: 500 });
    // Prefer the inline-edited HTML when the wizard sends it; else render fresh.
    const html = body.bodyHtml?.trim()
      ? body.bodyHtml
      : renderEventEmail(merge, { type, includeBanner: body.includeBanner, includeLobby: body.includeLobby, bookletUrl });

    const input = {
      name: `${event.title} — ${type.replace("_", " ")}`,
      list_id: listId,
      template_id: null,
      subject_override: subject.trim(),
      body_override: html,
      status: body.scheduleAt ? "scheduled" : "draft",
      scheduled_at: body.scheduleAt ?? null,
      // event linkage (new columns from 20260725001_event_email.sql)
      event_id: eventId,
      event_email_type: type,
      merge_snapshot: merge,
    } as unknown as Partial<MarketingCampaign>;

    const campaign = await createCampaign(input, auth.userId);
    return NextResponse.json({ campaignId: campaign.id, status: campaign.status, registrantCount });
  } catch (err) {
    Sentry.captureException(err);
    // Supabase/PostgREST errors are plain objects ({message, code, details, hint}),
    // not Error instances — String(err) would collapse to "[object Object]".
    const detail =
      err instanceof Error ? err.message
      : err && typeof err === "object" && "message" in err ? String((err as { message?: unknown }).message ?? "")
      : String(err);
    // Most likely cause pre-migration: unknown column event_id/event_email_type/merge_snapshot.
    return NextResponse.json({ error: `Couldn't create the campaign. ${detail.slice(0, 200)}` }, { status: 500 });
  }
}
