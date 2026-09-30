/**
 * Term sheet and data room links for the IR email dialog.
 *   GET  → { companyId, companyName, documents: [{ id, name, type, size, created_at }] }  (the linked company's live files)
 *   POST { kinds: ("term_sheet" | "data_room")[], matchIds, documentId?, upload?: { path, name }, expiresDays?, testEmail? }
 *        → { links: [{ kind, label, url }] }  url carries {{email}}, filled per recipient by the send.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { getProject } from "@/lib/ir/db";
import { companyDocuments, companyName, createShareLinks } from "@/lib/ir/share-links";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  const { id } = await ctx.params;
  try {
    const project = await getProject(id);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    if (!project.company_id) return NextResponse.json({ companyId: null, companyName: null, documents: [] });
    const [name, documents] = await Promise.all([companyName(project.company_id), companyDocuments(project.company_id)]);
    return NextResponse.json({ companyId: project.company_id, companyName: name, documents });
  } catch (e) { return failed(e, "Couldn't load the company's files."); }
}

const schema = z.object({
  kinds: z.array(z.enum(["term_sheet", "data_room"])).min(1).max(2),
  matchIds: z.array(z.string().uuid()).max(5000),
  documentId: z.string().uuid().nullish(),
  upload: z.object({ path: z.string().max(400), name: z.string().max(200) }).nullish(),
  expiresDays: z.number().int().min(1).max(365).nullish(),
  testEmail: z.string().email().max(200).nullish(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const me = await irStaff();
  if (!me) return forbidden();
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const d = parsed.data;
  try {
    const project = await getProject(id);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const links = await createShareLinks({
      projectId: id, companyId: project.company_id, kinds: [...new Set(d.kinds)], matchIds: d.matchIds, by: me.id,
      documentId: d.documentId ?? null, upload: d.upload ?? null, expiresDays: d.expiresDays ?? null, testEmail: d.testEmail ?? null,
    });
    return NextResponse.json({ links });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't create the link." }, { status: 400 }); }
}
