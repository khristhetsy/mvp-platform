import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requirePermissionApi } from "@/lib/api/permissions";
import { getEdition } from "@/lib/event-hub/brochure/editions";
import { renderBookletHTML } from "@/lib/event-hub/brochure/render";
import { brochureQrDataUrl } from "@/lib/event-hub/brochure/qr";
import { computePreflight } from "@/lib/event-hub/brochure/preflight";
import { loadEventMergeData } from "@/lib/event-email/merge";

export const dynamic = "force-dynamic";
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com";

/** Render the booklet preview HTML for an edition (same renderer as export). */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const edition = await getEdition(auth.supabase, id);
    if (!edition) return NextResponse.json({ error: "Edition not found." }, { status: 404 });
    if (!edition.eventId) return NextResponse.json({ error: "Archived imports have no live preview." }, { status: 400 });
    const merge = await loadEventMergeData(auth.supabase, edition.eventId, { baseUrl: BASE_URL, campaignId: `brochure-${id}` });
    if (!merge) return NextResponse.json({ error: "Couldn't build merge data." }, { status: 500 });

    // Auto-exclude the presenters page when there are no presenters (§6).
    const preflight = computePreflight(merge);
    const pages = preflight.excludePresenters
      ? edition.pageConfig.map((p) => (p.type === "presenters" ? { ...p, included: false } : p))
      : edition.pageConfig;

    const qrDataUrl = await brochureQrDataUrl(BASE_URL, id).catch(() => undefined);
    const html = renderBookletHTML(pages, merge, edition.overrides, edition.size, { qrDataUrl, theme: edition.theme });
    // Source values for the copy editor's markers (§6) + cover-customize seeding.
    const source = {
      title: merge.title,
      tagline: merge.tagline,
      dateLabel: `${merge.dateLabel}${merge.timeRange ? ` · ${merge.timeRange}` : ""}`,
      badge: merge.badge,
    };
    return NextResponse.json({ html, preflight, source });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Couldn't render the preview." }, { status: 500 });
  }
}
