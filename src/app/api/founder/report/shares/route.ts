import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/data/audit";
import { resolveFounderOwnCompany } from "@/lib/founder-api/own-company";
import { listShareSummaries, newShareToken } from "@/lib/reports/report-shares";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Secure share links for the founder's diligence report.
 *   GET    list links with views and last opened
 *   POST   create a link        body { label?: string }
 *   PATCH  turn a link off      body { id: string }
 * The company always comes from the founder's own account; a link id from the
 * body is only acted on when it belongs to that company.
 */
export async function GET() {
  const resolved = await resolveFounderOwnCompany();
  if ("error" in resolved) return resolved.error;
  const shares = await listShareSummaries(resolved.companyId);
  return NextResponse.json({ shares });
}

export async function POST(request: Request) {
  const resolved = await resolveFounderOwnCompany();
  if ("error" in resolved) return resolved.error;
  const { profile, companyId } = resolved;

  const body = (await request.json().catch(() => null)) as { label?: unknown } | null;
  const label = typeof body?.label === "string" ? body.label.trim().slice(0, 120) || null : null;

  // diligence_report_shares is not in the generated types yet.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createServiceRoleClient() as any;
  const { count } = await admin
    .from("diligence_reports")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);
  if (!count) {
    return NextResponse.json({ error: "Generate your due diligence report before sharing it." }, { status: 400 });
  }

  const { data, error } = await admin
    .from("diligence_report_shares")
    .insert({ company_id: companyId, token: newShareToken(), label, created_by: profile.id })
    .select("id")
    .single();
  if (error || !data) {
    return NextResponse.json({ error: "Could not create the link. Please try again." }, { status: 500 });
  }

  await writeAuditLog(admin, {
    userId: profile.id,
    action: "diligence_report_share.created",
    entityType: "diligence_report_share",
    entityId: data.id,
    metadata: { companyId, label },
  }).catch(() => null);

  const shares = await listShareSummaries(companyId);
  return NextResponse.json({ ok: true, id: data.id, shares });
}

export async function PATCH(request: Request) {
  const resolved = await resolveFounderOwnCompany();
  if ("error" in resolved) return resolved.error;
  const { profile, companyId } = resolved;

  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  const id = typeof body?.id === "string" && /^[0-9a-f-]{36}$/i.test(body.id) ? body.id : null;
  if (!id) return NextResponse.json({ error: "A link id is required." }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createServiceRoleClient() as any;
  const { data, error } = await admin
    .from("diligence_report_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("company_id", companyId)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: "Could not turn the link off. Please try again." }, { status: 500 });
  }
  if (data) {
    await writeAuditLog(admin, {
      userId: profile.id,
      action: "diligence_report_share.revoked",
      entityType: "diligence_report_share",
      entityId: id,
      metadata: { companyId },
    }).catch(() => null);
  }

  const shares = await listShareSummaries(companyId);
  return NextResponse.json({ ok: true, shares });
}
