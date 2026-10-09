import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { queueDealNotices } from "@/lib/listing/listing-server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST { companyId }: matches the listed company against the investor network
 * again and queues notices for NEW matches only (existing rows are untouched).
 * Nothing is sent here.
 */
export async function POST(request: Request) {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;
  const body = (await request.json().catch(() => null)) as { companyId?: unknown } | null;
  const companyId = typeof body?.companyId === "string" && /^[0-9a-f-]{36}$/i.test(body.companyId) ? body.companyId : null;
  if (!companyId) return NextResponse.json({ error: "companyId is required." }, { status: 400 });
  try {
    const added = await queueDealNotices(companyId);
    return NextResponse.json({ added });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
