import { NextResponse } from "next/server";
import { notFound, requireContractsApi } from "@/lib/contracts/access";
import { getTemplate, listTemplateHistory } from "@/lib/contracts/store";

export const dynamic = "force-dynamic";

/** GET — every version of a master with date and author. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requireContractsApi();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const tpl = await getTemplate(auth.actor.db, id);
  if (!tpl) return notFound();
  const versions = await listTemplateHistory(auth.actor.db, tpl.key);
  return NextResponse.json({
    name: tpl.name,
    versions: versions.map((v) => ({ id: v.id, version: v.version, status: v.status, filename: v.master_filename, created_at: v.created_at, author: v.author })),
  });
}
