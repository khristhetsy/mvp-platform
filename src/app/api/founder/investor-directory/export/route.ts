/**
 * Export the founder's own held directory contacts as CSV. Only when the admin
 * rule allows exports AND the founder's plan includes them. Never includes
 * iCFO network investors (they are never in the directory).
 */
import { NextResponse } from "next/server";
import { requireFounderInvestorCrmApi } from "@/lib/api/founder-crm";
import { heldContactsForExport, loadFounderAccess, loadSettings, logEvent } from "@/lib/investor-directory/db";

export const dynamic = "force-dynamic";

const cell = (v: string | null | undefined) => {
  const s = v ?? "";
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

export async function GET() {
  const auth = await requireFounderInvestorCrmApi();
  if ("error" in auth) return auth.error;
  const [settings, access] = await Promise.all([loadSettings(), loadFounderAccess(auth.profile.id, auth.company.id)]);
  if (!settings.allow_export || !access.tier.can_export || access.status !== "active") {
    return NextResponse.json({ error: "Export isn't included on your plan." }, { status: 403 });
  }
  const rows = await heldContactsForExport(auth.company.id);
  const header = ["name", "firm", "email", "phone", "website", "investor_type", "stages", "industries", "location"];
  const keys = ["investor_name", "firm_name", "email", "phone", "website", "investor_type", "preferred_stages", "preferred_sectors", "geography"];
  const body = [
    "# For your own company's fundraising only. Redistribution is not allowed (iCapOS investor directory terms of use).",
    header.join(","),
    ...rows.map((r) => keys.map((k) => cell(r[k])).join(",")),
  ].join("\n");
  await logEvent(auth.profile.id, auth.company.id, "export", rows.length);
  return new Response(body, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="investor-directory-contacts.csv"' },
  });
}
