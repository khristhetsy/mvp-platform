/**
 * POST /api/admin/sales/opportunities/import — import Odoo crm.lead export into the
 * Sales Hub. Multipart form: `file` (the .xlsx export) + `mode` = "preview" | "commit".
 * Preview builds the plan and returns counts + a sample; commit inserts. Staff-only.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { parseOdooLeadExport, planImport, commitImport } from "@/lib/sales/odoo-import";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const mode = String(form?.get("mode") ?? "preview");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Attach the Odoo crm.lead .xlsx export." }, { status: 400 });
  }

  let rows;
  try {
    rows = await parseOdooLeadExport(await (file as File).arrayBuffer());
  } catch {
    return NextResponse.json({ error: "Couldn't read that file — export it from Odoo as .xlsx and try again." }, { status: 400 });
  }
  if (rows.length === 0) return NextResponse.json({ error: "No rows found in the file." }, { status: 400 });

  const plan = await planImport(rows);
  const summary = {
    total: rows.length,
    toCreate: plan.creates.length,
    skippedNoEmail: plan.skippedNoEmail,
    skippedDupInFile: plan.skippedDupInFile,
    skippedExisting: plan.skippedExisting,
    byStatus: plan.byStatus,
    sample: plan.creates.slice(0, 8).map((c) => ({ title: c.title, email: c.email, status: c.status, linked: !!c.contactCrmId, owner: !!c.ownerId })),
  };

  if (mode === "commit") {
    const { created } = await commitImport(plan.creates, profile.id);
    return NextResponse.json({ ...summary, created });
  }
  return NextResponse.json(summary);
}
