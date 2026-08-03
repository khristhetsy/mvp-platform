import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getEdition, brochureSignedUrl } from "@/lib/event-hub/brochure/editions";

export const dynamic = "force-dynamic";

/** Public, recipient-facing brochure link (used in "Send booklet" emails).
 *  Streams the DIGITAL variant of a generated edition only — drafts and the
 *  print/bleed variant are never exposed. Redirects to a short-lived signed URL. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const { id } = await params;
    const supabase = createServiceRoleClient();
    const edition = await getEdition(supabase, id);
    const serveable = edition && (edition.status === "generated" || edition.status === "archived_import");
    if (!serveable || !edition.published || !edition.pdfDigitalPath) {
      return new NextResponse("Booklet not available.", { status: 404 });
    }
    const url = await brochureSignedUrl(supabase, edition.pdfDigitalPath, 3600);
    if (!url) return new NextResponse("Booklet not available.", { status: 404 });
    return NextResponse.redirect(url);
  } catch (err) {
    Sentry.captureException(err);
    return new NextResponse("Booklet not available.", { status: 404 });
  }
}
