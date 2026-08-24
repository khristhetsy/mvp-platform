import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requirePermissionApi } from "@/lib/api/permissions";
import { getEdition, markGenerated, uploadBrochurePdf } from "@/lib/event-hub/brochure/editions";
import { renderBrochurePdf } from "@/lib/event-hub/brochure/pdf";
import { brochureQrPng } from "@/lib/event-hub/brochure/qr";
import { computePreflight } from "@/lib/event-hub/brochure/preflight";
import { loadEventMergeData } from "@/lib/event-email/merge";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com";

/** Freeze snapshot, render print + digital PDFs (pdfkit), upload to storage, and
 *  mark generated. If the storage bucket isn't provisioned yet the edition still
 *  saves (snapshot) and reports that PDFs need the bucket. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const edition = await getEdition(auth.supabase, id);
    if (!edition) return NextResponse.json({ error: "Edition not found." }, { status: 404 });
    if (!edition.eventId) return NextResponse.json({ error: "Archived imports can't be regenerated." }, { status: 400 });
    const merge = await loadEventMergeData(auth.supabase, edition.eventId, { baseUrl: BASE_URL, campaignId: `brochure-${id}` });
    if (!merge) return NextResponse.json({ error: "Couldn't build merge data." }, { status: 500 });

    // Auto-exclude presenters page when empty (§6).
    const preflight = computePreflight(merge);
    const pages = preflight.excludePresenters
      ? edition.pageConfig.map((p) => (p.type === "presenters" ? { ...p, included: false } : p))
      : edition.pageConfig;

    let printPath: string | null = null;
    let digitalPath: string | null = null;
    let pdfWarning: string | null = null;
    try {
      const qr = await brochureQrPng(BASE_URL, id).catch(() => undefined);
      // Fetch the event banner so the cover renders the photo, not a flat navy.
      const coverImage = merge.bannerUrl
        ? await fetch(merge.bannerUrl).then((r) => (r.ok ? r.arrayBuffer() : null)).then((b) => (b ? Buffer.from(b) : undefined)).catch(() => undefined)
        : undefined;
      const [printBuf, digitalBuf] = await Promise.all([
        renderBrochurePdf(merge, pages, edition.overrides, edition.size, { bleed: true, qr, theme: edition.theme, coverImage }),
        renderBrochurePdf(merge, pages, edition.overrides, edition.size, { bleed: false, qr, theme: edition.theme, coverImage }),
      ]);
      printPath = await uploadBrochurePdf(auth.supabase, id, "print", printBuf);
      digitalPath = await uploadBrochurePdf(auth.supabase, id, "digital", digitalBuf);
    } catch (e) {
      pdfWarning = `Edition saved, but PDFs couldn't be stored (${e instanceof Error ? e.message.slice(0, 120) : "storage error"}). Ensure the 'event-brochures' bucket exists.`;
    }

    const updated = await markGenerated(auth.supabase, id, merge, { printPath, digitalPath });
    return NextResponse.json({ edition: updated, pdfWarning });
  } catch (err) {
    Sentry.captureException(err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Couldn't generate. ${detail.slice(0, 200)}` }, { status: 500 });
  }
}
