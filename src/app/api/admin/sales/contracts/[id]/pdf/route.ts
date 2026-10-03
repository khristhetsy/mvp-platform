import { NextResponse } from "next/server";
import { bad } from "@/lib/contracts/access";
import { bundleOpenFields, fileBase, renderBundlePdf } from "@/lib/contracts/service";
import { getFile } from "@/lib/contracts/store";
import { RenderFailedError, RenderUnavailableError } from "@/lib/contracts/render-pdf";
import { actorAndBundle, errorMessage, pdfResponse } from "@/lib/contracts/route-helpers";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * GET ?kind=
 *   preview      true render of the current draft, open fields shown as [Label]; view only
 *   final        true render for download; blocked while any required field is open
 *   sent         the exact PDF the prospect received
 *   executed     the countersigned copy
 *   certificate  the signature certificate
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const r = await actorAndBundle(id);
  if ("error" in r) return r.error;
  const { actor, b } = r;
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") ?? "preview";
  const download = url.searchParams.get("download") === "1";
  const name = fileBase(b);

  try {
    if (kind === "sent") {
      if (!b.doc.pdf_path) return bad("This version has not been sent.", 404);
      return pdfResponse(await getFile(actor.db, b.doc.pdf_path), `${name}.pdf`, download);
    }
    if (kind === "executed") {
      if (!b.doc.executed_path) return bad("No executed copy yet.", 404);
      return pdfResponse(await getFile(actor.db, b.doc.executed_path), `${name}_EXECUTED.pdf`, download);
    }
    if (kind === "certificate") {
      if (!b.doc.certificate_path) return bad("No certificate yet.", 404);
      return pdfResponse(await getFile(actor.db, b.doc.certificate_path), `${name}_certificate.pdf`, download);
    }
    if (kind === "final") {
      const open = bundleOpenFields(b);
      if (open.length) return bad(`Fill the open fields first: ${open.map((f) => f.label).join(", ")}.`, 409, { open });
      if (b.doc.locked && b.doc.pdf_path) return pdfResponse(await getFile(actor.db, b.doc.pdf_path), `${name}.pdf`, true);
      return pdfResponse(await renderBundlePdf(actor.db, b, "final"), `${name}.pdf`, true);
    }
    // preview: internal viewing only, never a download.
    return pdfResponse(await renderBundlePdf(actor.db, b, "preview"), `${name}_PREVIEW.pdf`, false);
  } catch (err) {
    if (err instanceof RenderUnavailableError) return NextResponse.json({ error: err.message, code: "render_unavailable" }, { status: 503 });
    if (err instanceof RenderFailedError) return NextResponse.json({ error: err.message }, { status: 502 });
    return NextResponse.json({ error: errorMessage(err, "Could not produce the PDF.") }, { status: 500 });
  }
}
