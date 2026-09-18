/**
 * One founder document.
 *   PATCH { status?: "archived" | "uploaded", label?: string | null } → { ok }
 * Archive hides a file from the category, the report and the data room (nothing is deleted);
 * restore brings it back; label renames it. The founder must manage the document's company.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/data/audit";
import { userHasCompanyAccess } from "@/lib/onboarding/ensure-founder-setup";

const schema = z.object({
  status: z.enum(["archived", "uploaded"]).optional(),
  label: z.string().max(160).nullable().optional(),
});

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success || (parsed.data.status === undefined && parsed.data.label === undefined)) {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }
  const admin = createServiceRoleClient();
  const { data: doc } = await admin.from("documents").select("id, company_id, document_type, status").eq("id", id).maybeSingle();
  if (!doc) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  if (doc.document_type === "SPV_REQUIREMENT") return NextResponse.json({ error: "This document is managed by staff." }, { status: 403 });
  if (!(await userHasCompanyAccess(auth.profile.id, doc.company_id))) {
    return NextResponse.json({ error: "You do not have access to this company." }, { status: 403 });
  }
  const patch: { status?: string; label?: string | null } = {};
  if (parsed.data.status !== undefined) patch.status = parsed.data.status;
  if (parsed.data.label !== undefined) patch.label = parsed.data.label?.trim() || null;
  const { error } = await admin.from("documents").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await writeAuditLog(admin, {
    userId: auth.profile.id,
    action: patch.status === "archived" ? "document.archived" : patch.status === "uploaded" ? "document.restored" : "document.relabeled",
    entityType: "document",
    entityId: id,
    metadata: { company_id: doc.company_id, document_type: doc.document_type, ...patch },
  });
  return NextResponse.json({ ok: true });
}
