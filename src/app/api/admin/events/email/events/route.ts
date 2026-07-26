import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requirePermissionApi } from "@/lib/api/permissions";
import { listAllEvents } from "@/lib/icfo-events/queries";
import { bannerPublicUrl } from "@/lib/icfo-events/banner";

export const dynamic = "force-dynamic";

/** Events available for the Event Email picker: published or live only (§9). */
export async function GET(): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const all = await listAllEvents(auth.supabase);
    const events = all
      .filter((e) => e.status === "published" || e.status === "live")
      .map((e) => ({
        id: e.id,
        title: e.title,
        slug: e.slug,
        status: e.status,
        startsAt: e.startsAt,
        coverUrl: bannerPublicUrl(auth.supabase, e.coverPath),
      }));
    return NextResponse.json({ events });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Couldn't load events." }, { status: 500 });
  }
}
