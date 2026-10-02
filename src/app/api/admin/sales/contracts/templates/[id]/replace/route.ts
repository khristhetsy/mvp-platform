import { NextResponse } from "next/server";
import { bad, forbidden, requireContractsApi } from "@/lib/contracts/access";
import { replaceMaster } from "@/lib/contracts/store";
import { TemplateMatchError } from "@/lib/contracts/docx-engine";
import { writeAuditLog } from "@/lib/data/audit";
import { errorMessage } from "@/lib/contracts/route-helpers";

export const dynamic = "force-dynamic";

const MAX_BYTES = 15 * 1024 * 1024;

/**
 * POST — Replace file: upload a new Word version of a master (admin only).
 * Field maps carry over; the upload is refused, naming the missing text, if
 * any field cannot be found in it. Sent documents keep the version they used.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requireContractsApi();
  if ("error" in auth) return auth.error;
  const { actor } = auth;
  if (!actor.isAdmin) return forbidden("Only an admin can replace a master.");
  const { id } = await params;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return bad("No file was uploaded.");
  if (!/\.docx$/i.test(file.name)) return bad("Masters must be Word (.docx) files so the layout renders exactly.");
  if (file.size > MAX_BYTES) return bad("File is too large (15 MB limit).");
  try {
    const result = await replaceMaster(actor.db, id, Buffer.from(await file.arrayBuffer()), file.name, actor.userId);
    await writeAuditLog(actor.db, { userId: actor.userId, action: "contracts.template_replaced", entityType: "contract_templates", entityId: result.id, metadata: { replaced: id, version: result.version, filename: file.name } });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof TemplateMatchError) return bad(err.message, 422, { missing: err.missing });
    return NextResponse.json({ error: errorMessage(err, "Replace failed.") }, { status: 500 });
  }
}
