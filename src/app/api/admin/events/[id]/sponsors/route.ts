import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requirePermissionApi } from "@/lib/api/permissions";
import { linkSponsorSchema } from "@/lib/icfo-events/schemas";
import { linkSponsorToEvent, unlinkSponsorFromEvent } from "@/lib/icfo-events/sponsors";
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
