import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requireStaffApi } from "@/lib/api/admin";
import { getBusinessPlan } from "@/lib/business-plan/store";

export const dynamic = "force-dynamic";

/** Staff: read a company's business plan for the admin workspace panel. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ companyId: string }> },
): Promise<Response> {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { companyId } = await params;
    const plan = await getBusinessPlan(auth.supabase, companyId);
    return NextResponse.json({ plan });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to load business plan." }, { status: 500 });
  }
}
