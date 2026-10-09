import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { sendQueuedDealNotices } from "@/lib/listing/deal-notices";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST { companyId? }: sends ONE batch (up to 100) of queued deal notices,
 * oldest first, and returns sent / skipped / failed and how many remain queued.
 * The page calls it repeatedly so staff see progress per batch. Demo or
 * internal founder accounts are skipped inside sendQueuedDealNotices.
 */
export async function POST(request: Request) {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;
  const body = (await request.json().catch(() => null)) as { companyId?: unknown } | null;
  const companyId = typeof body?.companyId === "string" && /^[0-9a-f-]{36}$/i.test(body.companyId) ? body.companyId : null;
  try {
    const result = await sendQueuedDealNotices({ companyId, limit: 100 });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
