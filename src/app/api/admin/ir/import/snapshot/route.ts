/** Full Odoo Deals2Match snapshot as a JSON download (pre-cutover backup). Odoo is only read. */
import { NextResponse } from "next/server";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { odooSnapshot } from "@/lib/ir/odoo-reconcile";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  try {
    const snap = await odooSnapshot();
    const name = `odoo-deals2match-snapshot-${snap.readAt.slice(0, 10)}.json`;
    return new NextResponse(JSON.stringify(snap, null, 1), { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="${name}"` } });
  } catch (e) { return failed(e, "Couldn't read the Odoo snapshot."); }
}
