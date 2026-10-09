import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/data/audit";
import { loadListingChecklist, markListingCompleteIfReady } from "@/lib/listing/listing-server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { resolveFounderOwnCompany } from "@/lib/founder-api/own-company";

export const dynamic = "force-dynamic";

/**
 * POST /api/founder/listing/opt-in   body { optIn: boolean }
 *
 * true sets listing_opt_in_at (checklist item 4). false clears it, which
 * unlists the company: the Private Market only shows companies with BOTH
 * listing_completed_at and listing_opt_in_at. listing_completed_at is left as
 * the record of when the checklist first completed (it drives deal notices
 * once, and never again).
 */
export async function POST(request: Request) {
  const resolved = await resolveFounderOwnCompany();
  if ("error" in resolved) return resolved.error;
  const { profile, companyId } = resolved;

  const body = (await request.json().catch(() => null)) as { optIn?: unknown } | null;
  if (typeof body?.optIn !== "boolean") {
    return NextResponse.json({ error: "optIn must be true or false." }, { status: 400 });
  }
  const optIn = body.optIn;

  // listing_opt_in_at is not in the generated types yet.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createServiceRoleClient() as any;
  const now = new Date().toISOString();
  const { error } = await admin
    .from("companies")
    .update({ listing_opt_in_at: optIn ? now : null })
    .eq("id", companyId);
  if (error) {
    return NextResponse.json({ error: "Could not save your choice. Please try again." }, { status: 500 });
  }

  await writeAuditLog(admin, {
    userId: profile.id,
    action: optIn ? "listing.opted_in" : "listing.opted_out",
    entityType: "company",
    entityId: companyId,
    metadata: { at: now },
  }).catch(() => null);

  // Does nothing after an opt out (the checklist is no longer complete).
  let completedNow = false;
  try {
    completedNow = (await markListingCompleteIfReady(companyId)).completedNow;
  } catch (err) {
    console.error("[listing] markListingCompleteIfReady failed after opt in", err);
  }

  const checklist = await loadListingChecklist(companyId);
  return NextResponse.json({ ok: true, completedNow, checklist });
}
