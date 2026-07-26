import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requirePermissionApi } from "@/lib/api/permissions";
import { getEdition, setPublished } from "@/lib/event-hub/brochure/editions";

export const dynamic = "force-dynamic";

/** Toggle publish-to-event-page for a generated edition (§9). Publishing exposes
 *  the DIGITAL PDF at the public /events/brochure/[id] link used by "Send booklet". */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { published?: boolean };
    const published = body.published !== false;
    const edition = await getEdition(auth.supabase, id);
    if (!edition) return NextResponse.json({ error: "Edition not found." }, { status: 404 });
    const hasPdf = (edition.status === "generated" || edition.status === "archived_import") && edition.pdfDigitalPath;
    if (published && !hasPdf) {
      return NextResponse.json({ error: "Generate or import the booklet PDF before publishing." }, { status: 400 });
    }
    const updated = await setPublished(auth.supabase, id, published);
    return NextResponse.json({ edition: updated });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Couldn't update publish state." }, { status: 500 });
  }
}
