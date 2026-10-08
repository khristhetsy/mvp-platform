import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/data/audit";
import { userHasCompanyAccess } from "@/lib/onboarding/ensure-founder-setup";
import { NA_ALLOWED_TYPES, normalizeNaType, setNotApplicable } from "@/lib/documents/not-applicable";
import { getActingContext } from "@/lib/admin/act-on-behalf";

const schema = z.object({
  companyId: z.string().uuid(),
  documentType: z.string().min(1).max(60),
  notApplicable: z.boolean(),
  /** Optional note shown wherever the N/A appears. */
  reason: z.string().max(300).optional().nullable(),
});

export async function POST(request: Request) {
  // Founders mark their own company; staff acting on behalf of a founder may
  // mark that founder's company (the acting context is re-verified server-side).
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error;
  const acting = auth.profile.role === "founder" ? null : await getActingContext();
  if (auth.profile.role !== "founder" && !acting) {
    return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { companyId, documentType, notApplicable, reason } = parsed.data;
  const type = normalizeNaType(documentType);
  if (!NA_ALLOWED_TYPES.has(type)) {
    return NextResponse.json({ error: "This document type cannot be marked not applicable." }, { status: 400 });
  }

  // Ownership: the founder must manage this company.
  const hasAccess = await userHasCompanyAccess(acting ? acting.founderId : auth.profile.id, companyId);
  if (!hasAccess) {
    return NextResponse.json({ error: "You do not have access to this company." }, { status: 403 });
  }

  const admin = createServiceRoleClient();
  const { error } = await setNotApplicable(admin, {
    companyId,
    documentType: type,
    markedBy: auth.profile.id,
    notApplicable,
    reason: reason?.trim() || null,
  });
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  await writeAuditLog(admin, {
    userId: auth.profile.id,
    action: notApplicable ? "document.marked_not_applicable" : "document.cleared_not_applicable",
    entityType: "company",
    entityId: companyId,
    metadata: { documentType: type, ...(acting ? { actingForFounderId: acting.founderId } : {}) },
  });

  return NextResponse.json({ ok: true });
}
