/** Odoo ↔ IR Hub reconciliation for one imported project. GET ?project=<id> → ReconcileResult; GET (no project) → { projects } importable ones. */
import { NextRequest, NextResponse } from "next/server";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { db } from "@/lib/ir/db";
import { reconcileProject } from "@/lib/ir/odoo-reconcile";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  const projectId = req.nextUrl.searchParams.get("project");
  try {
    if (!projectId) {
      const { data } = await db().from("ir_projects").select("id, title, founder_name, status, odoo_project_ids").not("odoo_project_ids", "is", null).order("created_at", { ascending: false });
      return NextResponse.json({ projects: ((data ?? []) as Array<{ id: string; title: string; founder_name: string | null; status: string; odoo_project_ids: number[] | null }>).filter((p) => (p.odoo_project_ids ?? []).length > 0) });
    }
    return NextResponse.json(await reconcileProject(projectId));
  } catch (e) { return failed(e, "Couldn't reconcile with Odoo."); }
}
