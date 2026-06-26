import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { requireUserProfile } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { track } from "@/lib/analytics/posthog";
import { notifyStaffIfNotRecent } from "@/lib/notifications/notifications";
import { createSponsorLead } from "@/lib/icfo-events/sponsors";

export const dynamic = "force-dynamic";

const schema = z.object({
  eventId: z.string().uuid().nullable().optional(),
  message: z.string().max(1000).nullable().optional(),
});

/** Attendee opts in to an intro with a sponsor. Opt-in only — staff fulfil it. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const profile = await requireUserProfile();
  try {
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const lead = await createSponsorLead(
      supabase,
      id,
      profile.id,
      parsed.data.eventId ?? null,
      parsed.data.message ?? null,
    );

    await notifyStaffIfNotRecent({
      actorUserId: profile.id,
      type: "event_sponsor_intro",
      title: "New sponsor intro request",
      message: `${profile.full_name ?? profile.email ?? "A member"} opted in to an intro with a sponsor.`,
      entityType: "sponsor_lead",
      entityId: lead.id,
      deepLink: "/admin/events/sponsors",
      withinHours: 1,
    });

    track("event_sponsor_intro", { userId: profile.id, sponsorId: id });
    return NextResponse.json({ ok: true, id: lead.id }, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    const detail = err instanceof Error ? err.message : String(err);
    if (detail.includes("duplicate key")) {
      return NextResponse.json({ ok: true, alreadyRequested: true });
    }
    return NextResponse.json({ error: "Failed to request intro." }, { status: 500 });
  }
}
