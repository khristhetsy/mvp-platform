import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { listBillingCustomers, getBillingStats, getWebhookHealth } from "@/lib/billing/admin-billing";

export const dynamic = "force-dynamic";

// GET /api/admin/billing/customers — customers + stats + webhook health.
export async function GET(): Promise<Response> {
  try {
    await requireRole(["admin", "analyst"]);
    const customers = await listBillingCustomers();
    const [stats, health] = await Promise.all([getBillingStats(customers), getWebhookHealth(customers)]);
    return NextResponse.json({ customers, stats, health });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
