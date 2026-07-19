import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/data/audit";
import { userHasCompanyAccess } from "@/lib/onboarding/ensure-founder-setup";
import { NA_ALLOWED_TYPES, normalizeNaType, setNotApplicable } from "@/lib/documents/not-applicable";

const schema = z.object({
  companyId: z.string().uuid(),
  documentType: z.string().min(1).max(60),
  notApplicable: z.boolean(),
});

export async function POST(request: Request) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { companyId, documentType, notApplicable } = parsed.data;
  const type = normalizeNaType(documentType);
  if (!NA_ALLOWED_TYPES.has(type)) {
    return NextResponse.json({ error: "This document type cannot be marked not applicable." }, { status: 400 });
  }

  // Ownership: the founder must manage this company.
  const hasAccess = await userHasCompanyAccess(auth.profile.id, companyId);
  if (!hasAccess) {
    return NextResponse.json({ error: "You do not have access to this company." }, { status: 403 });
  }

  const admin = createServiceRoleClient();
  const { error } = await setNotApplicable(admin, {
    companyId,
    documentType: type,
    markedBy: auth.profile.id,
    notApplicable,
  });
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  await writeAuditLog(admin, {
    userId: auth.profile.id,
    action: notApplicable ? "document.marked_not_applicable" : "document.cleared_not_applicable",
    entityType: "company",
    entityId: companyId,
    metadata: { documentType: type },
  });

  return NextResponse.json({ ok: true });
}
