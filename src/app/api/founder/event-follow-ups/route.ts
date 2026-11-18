import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { introDetail, recordFollowUp } from "@/lib/icfo-events/introductions-server";
import { canFounderFollowUp } from "@/lib/icfo-events/introductions";
import { sendBookingFollowUpFor } from "@/lib/icfo-events/booking-follow-up";

export const dynamic = "force-dynamic";

const schema = z.object({ introId: z.string().uuid() });

/**
 * A founder follows up an investor who accepted and has no time booked.
 *
 * Ownership is checked against the founder's own registration, so one founder
 * cannot send mail on another founder's introductions.
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const auth = await requireApiProfile(["founder"]);
    if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

    const detail = await introDetail(parsed.data.introId);
    if (!detail || detail.founder?.profileId !== auth.profile.id) {
      return NextResponse.json({ error: "That introduction was not found." }, { status: 404 });
    }

    const decision = canFounderFollowUp(detail.intro);
    if (!decision.send) return NextResponse.json({ error: decision.reason }, { status: 400 });

    const sent = await sendBookingFollowUpFor(detail.intro.id);
    if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: 400 });

    await recordFollowUp(detail.intro.id, detail.intro.followUps);
    return NextResponse.json({ ok: true, followUps: detail.intro.followUps + 1 });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Could not send the follow up." }, { status: 500 });
  }
}
