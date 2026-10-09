import { NextResponse } from "next/server";
import { requirePermissionApi } from "@/lib/api/permissions";
import { getWireInstructions, listWireInvoicesForAdmin } from "@/lib/billing/wire";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** GET /api/admin/billing/wire: every wire invoice, newest first (manage_billing). */
export async function GET(): Promise<Response> {
  const auth = await requirePermissionApi("manage_billing");
  if ("error" in auth) return auth.error as Response;
  try {
    const [invoices, instructions] = await Promise.all([listWireInvoicesForAdmin(), getWireInstructions()]);
    return NextResponse.json({ invoices, instructions });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load wire invoices." }, { status: 500 });
  }
}
