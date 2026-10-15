/**
 * One import.
 *   POST   → publish: its draft rows become visible to founders. { published }
 *   PATCH  { action: "update", name, source?, sourceUrl?, relabelRecords? } → { import }
 *          { action: "archive" | "restore" } → { ok }
 *   DELETE { withRecords?: boolean } → { recordsDeleted }
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { directoryAdmin, failed } from "@/lib/investor-directory/admin-auth";
import { deleteImport, publishImport, setImportArchived, updateImport } from "@/lib/investor-directory/db";

export const dynamic = "force-dynamic";

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("update"),
    name: z.string().trim().min(1).max(200),
    source: z.string().trim().min(1).max(200).optional(),
    sourceUrl: z.string().trim().url().max(1000).nullable().optional().or(z.literal("").transform(() => null)),
    relabelRecords: z.boolean().optional(),
  }),
  z.object({ action: z.literal("archive") }),
  z.object({ action: z.literal("restore") }),
]);

const deleteSchema = z.object({ withRecords: z.boolean().optional() });

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await directoryAdmin();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  try {
    return NextResponse.json({ published: await publishImport(id) });
  } catch (err) {
    return failed(err, "Couldn't publish the import.");
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await directoryAdmin();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the name, source and link, then try again." }, { status: 400 });
  try {
    const body = parsed.data;
    if (body.action === "archive" || body.action === "restore") {
      await setImportArchived(id, body.action === "archive");
      return NextResponse.json({ ok: true });
    }
    const imp = await updateImport(id, {
      name: body.name, source: body.source, sourceUrl: body.sourceUrl, relabelRecords: body.relabelRecords,
    });
    return NextResponse.json({ import: imp });
  } catch (err) {
    return failed(err, "Couldn't update the import.");
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await directoryAdmin();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const parsed = deleteSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  try {
    return NextResponse.json(await deleteImport(id, parsed.data.withRecords === true));
  } catch (err) {
    return failed(err, "Couldn't delete the import.");
  }
}
