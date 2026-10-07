/**
 * Create an iCapOS founder account (companies row) from the project's founder contact and link it.
 *   POST → { ok, companyId }   409 when the project already has a company or has no founder contact
 * Name and website come from the contact's Odoo questionnaire; the founder's answers stay on the contact.
 */
import { NextRequest, NextResponse } from "next/server";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { db, getProject, updateProject } from "@/lib/ir/db";
import { founderOdooProfile } from "@/lib/ir/founder-profile";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  const { id } = await ctx.params;
  try {
    const project = await getProject(id);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    if (project.company_id) return NextResponse.json({ error: "This project already has a company." }, { status: 409 });
    if (!project.founder_contact_id) return NextResponse.json({ error: "Pick the founder first." }, { status: 409 });
    const { data } = await db().from("crm_contacts").select("company, email, website, raw").eq("id", project.founder_contact_id).maybeSingle();
    const c = data as { company: string | null; email: string | null; website: string | null; raw: Record<string, unknown> | null } | null;
    if (!c) return NextResponse.json({ error: "Contact not found." }, { status: 404 });
    const odoo = founderOdooProfile(c.raw);
    const name = (odoo?.companyName ?? (c.company && c.company !== c.email ? c.company : null) ?? project.title).trim();
    const { data: row, error } = await db().from("companies").insert({ company_name: name, website: c.website ?? odoo?.website ?? null }).select("id").single();
    if (error) throw new Error(error.message);
    const companyId = (row as { id: string }).id;
    await updateProject(id, { company_id: companyId });
    return NextResponse.json({ ok: true, companyId });
  } catch (e) { return failed(e, "Couldn't create the company."); }
}
