import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requirePermissionApi } from "@/lib/api/permissions";
import { getEdition, brochureSignedUrl } from "@/lib/event-hub/brochure/editions";

export const dynamic = "force-dynamic";

/** Redirect to a short-lived signed URL for a generated brochure PDF. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const variant = req.nextUrl.searchParams.get("variant") === "print" ? "print" : "digital";
    const edition = await getEdition(auth.supabase, id);
    if (!edition) return NextResponse.json({ error: "Edition not found." }, { status: 404 });
    const p = variant === "print" ? edition.pdfPrintPath : edition.pdfDigitalPath;
    if (!p) return NextResponse.json({ error: "That PDF hasn't been generated yet." }, { status: 404 });
    const url = await brochureSignedUrl(auth.supabase, p);
    if (!url) return NextResponse.json({ error: "Couldn't sign the download URL." }, { status: 500 });
    return NextResponse.redirect(url);
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Couldn't download." }, { status: 500 });
  }
}
