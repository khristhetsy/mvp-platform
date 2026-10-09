import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { loadDealNoticeStats } from "@/lib/listing/deal-notice-admin";

export const dynamic = "force-dynamic";

/** GET: deal notice totals and per company counts. Staff only. */
export async function GET() {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;
  try {
    return NextResponse.json(await loadDealNoticeStats());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
