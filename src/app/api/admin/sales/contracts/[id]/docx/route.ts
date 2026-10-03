import { NextResponse } from "next/server";
import { bad } from "@/lib/contracts/access";
import { bundleOpenFields, fileBase, renderBundleDocx } from "@/lib/contracts/service";
import { getFile } from "@/lib/contracts/store";
import { actorAndBundle, errorMessage } from "@/lib/contracts/route-helpers";

export const dynamic = "force-dynamic";

/** GET — Export to Word. Blocked while required fields are open, so no incomplete copy leaves the platform. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const r = await actorAndBundle(id);
  if ("error" in r) return r.error;
  const { actor, b } = r;
  const open = bundleOpenFields(b);
  if (open.length) return bad(`Fill the open fields first: ${open.map((f) => f.label).join(", ")}.`, 409, { open });
  try {
    const bytes = b.doc.locked && b.doc.docx_path ? await getFile(actor.db, b.doc.docx_path) : await renderBundleDocx(actor.db, b, "final");
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${fileBase(b)}.docx"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err, "Could not export.") }, { status: 500 });
  }
}
