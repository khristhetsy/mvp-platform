import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requirePermissionApi } from "@/lib/api/permissions";
import { linkSponsorSchema } from "@/lib/icfo-events/schemas";
import {
  linkSponsorToEvent,
  unlinkSponsorFromEvent,
  getSponsorById,
  listEventSponsors,
} from "@/lib/icfo-events/sponsors";
import { logEventActivity } from "@/lib/icfo-events/activity";

export const dynamic = "force-dynamic";

/** Attach a sponsor to an event with a placement (staff). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const parsed = linkSponsorSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    // Enforce category exclusivity: one anchor per category per event.
    const incoming = await getSponsorById(auth.supabase, parsed.data.sponsorId);
    if (!incoming) return NextResponse.json({ error: "Sponsor not found." }, { status: 404 });
    const existing = await listEventSponsors(auth.supabase, id);
    const sameCategory = existing.filter(
      (es) => es.id !== incoming.id && es.category === incoming.category,
    );
    if (sameCategory.length > 0 && (incoming.categoryExclusive || sameCategory.some((es) => es.categoryExclusive))) {
      return NextResponse.json(
        { error: `A ${incoming.category} sponsor with category exclusivity is already attached to this event.` },
        { status: 409 },
      );
    }

    await linkSponsorToEvent(auth.supabase, id, parsed.data.sponsorId, parsed.data.placement);
    await logEventActivity(auth.supabase, id, auth.profile.id, "sponsor_added", {
      sponsorId: parsed.data.sponsorId,
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to attach sponsor." }, { status: 500 });
  }
}

/** Detach a sponsor from an event (staff). sponsorId in query string. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const sponsorId = req.nextUrl.searchParams.get("sponsorId");
    if (!sponsorId) return NextResponse.json({ error: "sponsorId required." }, { status: 400 });
    await unlinkSponsorFromEvent(auth.supabase, id, sponsorId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to detach sponsor." }, { status: 500 });
  }
}
