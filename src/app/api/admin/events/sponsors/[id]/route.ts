import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requirePermissionApi } from "@/lib/api/permissions";
import { sponsorBoothSchema } from "@/lib/icfo-events/schemas";
import { updateSponsorBooth } from "@/lib/icfo-events/sponsors";

export const dynamic = "force-dynamic";

/** Staff edits a sponsor's booth fields (video link, contact toggle, blurb, etc.). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const parsed = sponsorBoothSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const website = parsed.data.website === "" ? null : parsed.data.website;
    const meetingUrl = parsed.data.meetingUrl === "" ? null : parsed.data.meetingUrl;
    const sponsor = await updateSponsorBooth(auth.supabase, id, { ...parsed.data, website, meetingUrl });
    return NextResponse.json({ sponsor });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to update sponsor." }, { status: 500 });
  }
}
