import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requirePermissionApi } from "@/lib/api/permissions";
import { loadEventMergeData, type EventEmailType } from "@/lib/event-email/merge";
import { renderEventEmail } from "@/lib/event-email/render";

export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com";

/** Render the event email to HTML for the wizard's live preview. Same renderer
 *  used at send time, so preview and send never drift (§7). */
export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await req.json().catch(() => ({}))) as {
      eventId?: string;
      type?: EventEmailType;
      includeBanner?: boolean;
      includeLobby?: boolean;
      bookletUrl?: string;
    };
    if (!body.eventId) return NextResponse.json({ error: "Missing eventId." }, { status: 400 });
    const merge = await loadEventMergeData(auth.supabase, body.eventId, { baseUrl: BASE_URL });
    if (!merge) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    const html = renderEventEmail(merge, {
      type: body.type ?? "invite",
      includeBanner: body.includeBanner,
      includeLobby: body.includeLobby,
      bookletUrl: body.bookletUrl,
    });
    return NextResponse.json({ html });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Couldn't render preview." }, { status: 500 });
  }
}
