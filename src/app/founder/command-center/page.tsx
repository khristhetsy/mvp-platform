import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { computeReadinessScore, getLatestDiligenceReport } from "@/lib/data/founder-readiness";
import { listCompanyDocuments } from "@/lib/data/documents";
import { getCompanyPledgeSummary, getFounderPledgeCompanyId } from "@/lib/data/investor-pledges";
import {
  RaiseCommandCenter,
  type CommandCenterRoom,
  type CommandCenterInvestor,
} from "@/components/founder/RaiseCommandCenter";

export const dynamic = "force-dynamic";

type RawInvestor = {
  id: string;
  name: string;
  investor_type: string | null;
  outreach_status: string | null;
  meeting_requested: string | null;
  last_contact_date: string | null;
  next_follow_up_date: string | null;
  match_score: number | null;
  notes: string | null;
};

export default async function CommandCenterPage() {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("appPages");
  const company = await ensureFounderCompanyForUser(profile);
  const supabase = await createServerSupabaseClient();
  const serviceSupabase = createServiceRoleClient();

  // Fetch all data in parallel
  const [
    { data: rooms },
    { data: docRequests },
    { data: rawInvestors },
    { data: documents },
    { data: diligenceReport },
  ] = await Promise.all([
    supabase
      .from("deal_rooms")
      .select("id, title, status, updated_at")
      .eq("company_id", company?.id ?? "")
      .in("status", ["active", "pending"])
      .order("updated_at", { ascending: true })
      .limit(20),
    supabase
      .from("deal_room_document_requests")
      .select("room_id, status")
      .in("status", ["pending", "requested"])
      .limit(200),
    supabase
      .from("pipeline_investors")
      .select("id, name, investor_type, outreach_status, meeting_requested, last_contact_date, next_follow_up_date, match_score, notes")
      .eq("founder_id", profile.id)
      .order("next_follow_up_date", { ascending: true })
      .limit(50) as unknown as Promise<{ data: RawInvestor[] | null }>,
    company ? listCompanyDocuments(supabase, company.id) : Promise.resolve({ data: [] }),
    company ? getLatestDiligenceReport(supabase, company.id) : Promise.resolve({ data: null }),
  ]);

  // Unanswered questions per room
  const roomIds = (rooms ?? []).map((r) => r.id);
  const { data: questions } = roomIds.length > 0
    ? await supabase
        .from("deal_room_questions")
        .select("room_id, status")
        .in("room_id", roomIds)
        .neq("status", "resolved")
    : { data: [] };

  // Build counts per room
  const qCountByRoom = new Map<string, number>();
  const docCountByRoom = new Map<string, number>();
  for (const q of questions ?? []) {
    qCountByRoom.set(q.room_id, (qCountByRoom.get(q.room_id) ?? 0) + 1);
  }
  for (const d of docRequests ?? []) {
    docCountByRoom.set(d.room_id, (docCountByRoom.get(d.room_id) ?? 0) + 1);
  }

  const commandRooms: CommandCenterRoom[] = (rooms ?? []).map((r) => ({
    id: r.id,
    title: r.title ?? "Unnamed room",
    status: r.status ?? "active",
    updatedAt: r.updated_at ?? new Date().toISOString(),
    unansweredCount: qCountByRoom.get(r.id) ?? 0,
    pendingDocRequests: docCountByRoom.get(r.id) ?? 0,
  }));

  const commandInvestors: CommandCenterInvestor[] = (rawInvestors ?? []).map((inv) => ({
    id: inv.id,
    name: inv.name,
    investorType: inv.investor_type ?? "Investor",
    outreachStatus: inv.outreach_status ?? "not_started",
    meetingRequested: inv.meeting_requested ?? "none",
    lastContactDate: inv.last_contact_date,
    nextFollowUpDate: inv.next_follow_up_date,
    matchScore: inv.match_score,
    notes: inv.notes,
  }));

  const docsData = (documents as { data?: Array<{ document_type?: string | null }> } | null)?.data ?? [];
  const uploadedTypeCodes = docsData.flatMap((d) => (d.document_type ? [d.document_type] : []));
  const readinessScore = diligenceReport?.readiness_score ?? computeReadinessScore(uploadedTypeCodes);

  let pledgedAmount = 0;
  if (company) {
    const pledgeCompanyId = await getFounderPledgeCompanyId(serviceSupabase, profile.id, company.id);
    const summary = await getCompanyPledgeSummary(serviceSupabase, pledgeCompanyId);
    pledgedAmount = summary.totalPledged;
  }

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <FounderFeatureGate featureKey="dashboard">
        <div className="mx-auto max-w-3xl space-y-6">
          <PageHeader
            eyebrow={t("command_center")}
            title={t("raise_war_room")}
            description={t("every_active_deal_room_pending_follow_up_and_n")}
          />
          <RaiseCommandCenter
            rooms={commandRooms}
            investors={commandInvestors}
            readinessScore={readinessScore}
            pledgedAmount={pledgedAmount}
            fundingTarget={company?.funding_amount ? Number(company.funding_amount) : null}
            companyName={company?.company_name ?? "Your company"}
          />
        </div>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
