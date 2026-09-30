/**
 * Open Odoo activities for the investors on a task's Matching tab.
 *   GET ?matchIds=a,b,c → { configured, byMatch: { [matchId]: [{ id, type, summary, due, user, url }] } }
 */
import { NextRequest, NextResponse } from "next/server";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { openOdooActivitiesByMatch } from "@/lib/ir/odoo-open-activities";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  const ids = (req.nextUrl.searchParams.get("matchIds") ?? "").split(",").map((s) => s.trim()).filter((s) => /^[0-9a-f-]{36}$/i.test(s)).slice(0, 1000);
  try { return NextResponse.json(await openOdooActivitiesByMatch(ids)); }
  catch (e) { return failed(e, "Couldn't read Odoo activities."); }
}
