import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { getBillingCustomerDetail } from "@/lib/billing/admin-billing";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET /api/admin/billing/customers/[id] — profile + plan + invoices + statement.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    await requireRole(["admin", "analyst"]);
    const { id } = await params;
    return NextResponse.json(await getBillingCustomerDetail(id));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
