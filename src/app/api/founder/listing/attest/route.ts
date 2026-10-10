import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/data/audit";
import { loadListingChecklist, markListingCompleteIfReady } from "@/lib/listing/listing-server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { resolveFounderOwnCompany } from "@/lib/founder-api/own-company";

export const dynamic = "force-dynamic";

/**
 * POST /api/founder/listing/attest
 *
 * The founder confirms the revenue and cap table figures stored on their
 * company are accurate (checklist item 3). AI drafts, the founder owns the
 * facts: this is the founder's explicit confirmation, nothing is inferred.
 * Body: { confirm: true }.
 */
export async function POST(request: Request) {
  const resolved = await resolveFounderOwnCompany();
  if ("error" in resolved) return resolved.error;
  const { profile, companyId } = resolved;

  const body = (await request.json().catch(() => null)) as { confirm?: unknown } | null;
  if (body?.confirm !== true) {
    return NextResponse.json({ error: "Tick the box to confirm the figures are accurate." }, { status: 400 });
  }

  // figures_attested_at / _by are not in the generated types yet.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createServiceRoleClient() as any;
  const now = new Date().toISOString();
  const { error } = await admin
    .from("companies")
    .update({ figures_attested_at: now, figures_attested_by: profile.id })
    .eq("id", companyId);
  if (error) {
    return NextResponse.json({ error: "Could not save your confirmation. Please try again." }, { status: 500 });
  }

  await writeAuditLog(admin, {
    userId: profile.id,
    action: "listing.figures_attested",
    entityType: "company",
    entityId: companyId,
    metadata: { attestedAt: now },
  }).catch(() => null);

  let completedNow = false;
  try {
    completedNow = (await markListingCompleteIfReady(companyId)).completedNow;
  } catch (err) {
    console.error("[listing] markListingCompleteIfReady failed after attest", err);
  }

  const checklist = await loadListingChecklist(companyId);
  return NextResponse.json({ ok: true, completedNow, checklist });
}
