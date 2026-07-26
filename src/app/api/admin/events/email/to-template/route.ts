import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requirePermissionApi } from "@/lib/api/permissions";
import { loadEventMergeData, type EventEmailType } from "@/lib/event-email/merge";
import { renderEventEmail } from "@/lib/event-email/render";
import { getEventById } from "@/lib/icfo-events/queries";
import { createTemplate } from "@/lib/marketing/templates";

export const dynamic = "force-dynamic";
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com";

/** Hand the generated event email into the Marketing Hub editor: render the email
 *  to HTML and save it as a `category='event'` marketing template (blocks null, so
 *  the visual editor reverse-parses the HTML). Returns the new template id to
 *  deep-link into /admin/marketing/templates?edit=<id>. */
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
      subject?: string;
    };
    if (!body.eventId) return NextResponse.json({ error: "Missing event." }, { status: 400 });
    const event = await getEventById(auth.supabase, body.eventId).catch(() => null);
    if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });

    const merge = await loadEventMergeData(auth.supabase, body.eventId, { baseUrl: BASE_URL });
    if (!merge) return NextResponse.json({ error: "Couldn't build merge data." }, { status: 500 });

    const type = body.type ?? "invite";
    const html = renderEventEmail(merge, {
      type,
      includeBanner: body.includeBanner,
      includeLobby: body.includeLobby,
      bookletUrl: body.bookletUrl,
    });

    const template = await createTemplate(
      {
        name: `${event.title} — ${type.replace("_", " ")} (editable)`,
        subject: body.subject?.trim() || `You're invited: ${merge.title}`,
        preview_text: merge.tagline || null,
        html_body: html,
        blocks: null,
        category: "event",
        status: "draft",
      },
      auth.userId,
    );

    return NextResponse.json({ templateId: template.id });
  } catch (err) {
    Sentry.captureException(err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Couldn't open in designer. ${detail.slice(0, 200)}` }, { status: 500 });
  }
}
