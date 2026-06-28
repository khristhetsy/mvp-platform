import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { DealRoomQuestionsPanel } from "@/components/deal-room/DealRoomQuestionsPanel";
import { DealRoomDocRequestsPanel } from "@/components/deal-room/DealRoomDocRequestsPanel";
import { DealRoomMilestonePanel } from "@/components/deal-room/DealRoomMilestonePanel";
import { DealRoomViewEventTrigger } from "@/components/deal-room/DealRoomViewEventTrigger";
import { CollaborationDiscussionPanel } from "@/components/collaboration/CollaborationDiscussionPanel";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ roomId: string }> };

function formatCurrency(n: number | null | undefined): string | null {
  if (n == null) return null;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

export default async function InvestorDealRoomPage({ params }: PageProps) {
  const profile = await requireRole(["investor"]);
  const { roomId } = await params;
  const supabase = await createServerSupabaseClient();
  const admin = createServiceRoleClient();

  const [{ data: room }, { data: questions }, { data: docRequests }, { data: activity }] =
    await Promise.all([
      supabase
        .from("deal_rooms")
        .select("id, title, status, created_at, company_id")
        .eq("id", roomId)
        .maybeSingle(),
      supabase
        .from("deal_room_questions")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("deal_room_document_requests")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("deal_room_activity_events")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

  if (!room) notFound();

  // Fetch company snapshot if we have a company_id
  type CompanySnapshot = {
    company_name: string;
    industry: string | null;
    business_description: string | null;
    funding_amount: number | null;
    revenue_stage: string | null;
    onboarding_progress_percent: number | null;
    country: string | null;
    state: string | null;
    incorporation_jurisdiction: string | null;
  };

  let company: CompanySnapshot | null = null;

  if (room.company_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (admin as any)
      .from("companies")
      .select(
        "company_name, industry, business_description, funding_amount, revenue_stage, onboarding_progress_percent, country, state, incorporation_jurisdiction",
      )
      .eq("id", room.company_id)
      .maybeSingle();
    const { data } = result as { data: CompanySnapshot | null };
    company = data ?? null;
  }

  const hasViewed = (activity ?? []).some(
    (e) => e.event_type === "room_viewed" && e.actor_user_id === profile.id,
  );

  const location = [company?.state, company?.country].filter(Boolean).join(", ") || null;
  const funding = formatCurrency(company?.funding_amount);

  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle="Investor account"
    >
      {!hasViewed && <DealRoomViewEventTrigger roomId={roomId} />}

      <div className="space-y-6">
        <PageHeader
          eyebrow="Deal room"
          title={room.title}
          description="Ask structured due diligence questions and request documents. No funding commitment implied."
          metadata={`status: ${room.status}`}
        />

        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Educational/diligence collaboration only. No legal, tax, or investment advice. No funding commitments.
        </div>

        {/* Company snapshot */}
        {company && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                Company
              </p>
              <h2 className="mt-0.5 text-base font-bold text-slate-900">{company.company_name}</h2>
            </div>
            <div className="px-5 py-4">
              {company.business_description && (
                <p className="mb-4 text-sm leading-relaxed text-slate-600 line-clamp-3">
                  {company.business_description}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {company.industry && (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                    {company.industry}
                  </span>
                )}
                {company.revenue_stage && (
                  <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
                    {company.revenue_stage}
                  </span>
                )}
                {funding && (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                    {funding} target
                  </span>
                )}
                {location && (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">
                    {location}
                  </span>
                )}
                {company.incorporation_jurisdiction && (
                  <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                    Incorporated: {company.incorporation_jurisdiction}
                  </span>
                )}
                {company.onboarding_progress_percent != null && (
                  <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">
                    {company.onboarding_progress_percent}% readiness
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Milestone panel */}
        <DealRoomMilestonePanel
          room={{
            id: room.id,
            title: room.title,
            status: room.status,
            created_at: String(room.created_at),
          }}
          questions={(questions ?? []).map((q) => ({
            id: q.id,
            status: q.status,
            category: q.category,
            question: q.question,
            created_at: q.created_at,
            responded_at: q.responded_at as string | null,
          }))}
          docRequests={(docRequests ?? []).map((d) => ({
            id: d.id,
            status: d.status,
            request_type: d.request_type,
            custom_request: d.custom_request as string | null,
            created_at: d.created_at,
            fulfilled_at: d.fulfilled_at as string | null,
          }))}
          activity={(activity ?? []).map((e) => ({
            id: e.id,
            event_type: e.event_type,
            created_at: e.created_at,
          }))}
        />

        <section className="grid gap-6 xl:grid-cols-2">
          <WorkspacePanel title="Questions" subtitle={`${(questions ?? []).length} recent`}>
            <DealRoomQuestionsPanel
              roomId={roomId}
              viewerRole="investor"
              initialQuestions={questions ?? []}
            />
          </WorkspacePanel>
          <WorkspacePanel title="Document requests" subtitle={`${(docRequests ?? []).length} recent`}>
            <DealRoomDocRequestsPanel
              roomId={roomId}
              viewerRole="investor"
              initialRequests={docRequests ?? []}
            />
          </WorkspacePanel>
        </section>

        <WorkspacePanel title="Collaboration" subtitle="Discussion thread">
          <CollaborationDiscussionPanel entityType="deal_room" entityId={roomId} />
        </WorkspacePanel>
      </div>
    </AppShell>
  );
}
