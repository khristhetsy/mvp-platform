import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { getBillingCustomerDetail, updateBillingCustomer, deleteBillingCustomer } from "@/lib/billing/admin-billing";

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

const patchSchema = z.object({
  plan_type: z.enum(["founder_trial", "founder_basic", "founder_professional", "investor_free", "investor_pro", "investor_premium", "admin_internal"]).optional(),
  subscription_status: z.enum(["active", "trialing", "past_due", "cancelled", "expired", "paused"]).optional(),
  current_period_end: z.string().optional().nullable(),
});

// PATCH — edit the local subscription record (admin only). Never touches Lemon Squeezy.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    await requireRole(["admin"]);
    const { id } = await params;
    const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "A valid plan or status is required." }, { status: 400 });
    await updateBillingCustomer(id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to update." }, { status: 500 });
  }
}

// DELETE — remove the local subscription record only (admin only).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    await requireRole(["admin"]);
    const { id } = await params;
    await deleteBillingCustomer(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to delete." }, { status: 500 });
  }
}
