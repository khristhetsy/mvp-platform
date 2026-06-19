import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { getCompanyPledgeSummary, getFounderPledgeCompanyId } from "@/lib/data/investor-pledges";

export const dynamic = "force-dynamic";

export type RoundCloseStats = {
  fundingTarget: number | null;
  totalPledged: number;
  investorCount: number;
  currency: string;
  fillPct: number;
  pipeline: {
    not_started: number;
    contacted: number;
    in_progress: number;
    closed: number;
  };
  totalPipeline: number;
  interestedCount: number;
  pendingIntros: number;
};

export async function GET() {
  let profile;
  try {
    profile = await requireRole(["founder"]);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createServiceRoleClient();
  const company = await ensureFounderCompanyForUser(profile);
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  // Pledge summary from investor_interests (platform-linked investors)
  const pledgeCompanyId = await getFounderPledgeCompanyId(admin, profile.id, company.id);
  const pledge = await getCompanyPledgeSummary(admin, pledgeCompanyId);

  // Pipeline breakdown from pipeline_investors (founder-managed CRM)
  // Cast required: pipeline_investors was added in a migration whose types haven't been regenerated
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pipelineResult = await (admin as any)
    .from("pipeline_investors")
    .select("outreach_status, interested")
    .eq("founder_id", profile.id);
  const pipelineRows: Array<{ outreach_status: string | null; interested: boolean | null }> =
    (pipelineResult.data as Array<{ outreach_status: string | null; interested: boolean | null }>) ?? [];

  const pipeline = { not_started: 0, contacted: 0, in_progress: 0, closed: 0 };
  let interestedCount = 0;

  for (const row of pipelineRows) {
    const s = row.outreach_status as keyof typeof pipeline | null;
    if (s && s in pipeline) pipeline[s]++;
    if (row.interested) interestedCount++;
  }

  // Pending intro requests for this company
  const { count: pendingIntros } = await admin
    .from("intro_requests")
    .select("id", { count: "exact", head: true })
    .eq("company_id", company.id)
    .in("status", ["requested", "reviewing"]);

  const fundingTarget = company.funding_amount ? Number(company.funding_amount) : null;
  const fillPct =
    fundingTarget && fundingTarget > 0
      ? Math.min(100, Math.round((pledge.totalPledged / fundingTarget) * 100))
      : 0;

  const stats: RoundCloseStats = {
    fundingTarget,
    totalPledged: pledge.totalPledged,
    investorCount: pledge.investorCount,
    currency: pledge.currency,
    fillPct,
    pipeline,
    totalPipeline: (pipelineRows ?? []).length,
    interestedCount,
    pendingIntros: pendingIntros ?? 0,
  };

  return NextResponse.json(stats);
}
