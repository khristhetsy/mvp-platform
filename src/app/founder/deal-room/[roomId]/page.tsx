import { notFound } from "next/navigation";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DealRoomQuestionsPanel, type DealRoomCompanySnapshot } from "@/components/deal-room/DealRoomQuestionsPanel";
import { DealRoomDocRequestsPanel } from "@/components/deal-room/DealRoomDocRequestsPanel";
import { DealRoomMilestonePanel } from "@/components/deal-room/DealRoomMilestonePanel";
import { DealRoomActivityPanel } from "@/components/deal-room/DealRoomActivityPanel";
import { CollaborationDiscussionPanel } from "@/components/collaboration/CollaborationDiscussionPanel";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ roomId: string }> };

export default async function FounderDealRoomPage({ params }: PageProps) {
  const profile = await requireRole(["founder"]);
  const { roomId } = await params;
  const supabase = await createServerSupabaseClient();

  const [{ data: room }, { data: questions }, { data: docRequests }, { data: activity }, { data: company }, { data: documents }] = await Promise.all([
    supabase.from("deal_rooms").select("id, title, status, created_at").eq("id", roomId).maybeSingle(),
    supabase.from("deal_room_questions").select("*").eq("room_id", roomId).order("created_at", { ascending: false }).limit(200),
    supabase.from("deal_room_document_requests").select("*").eq("room_id", roomId).order("created_at", { ascending: false }).limit(200),
    supabase.from("deal_room_activity_events").select("*").eq("room_id", roomId).order("created_at", { ascending: false }).limit(200),
    supabase.from("companies").select("company_name, industry, business_description, revenue_stage, funding_amount, country, state").eq("founder_id", profile.id).maybeSingle(),
    supabase.from("documents").select("id, file_name, document_type").eq("uploaded_by", profile.id).order("created_at", { ascending: false }).limit(100),
  ]);

  const companySnapshot: DealRoomCompanySnapshot | undefined = company
    ? {
        companyName: company.company_name ?? "Your company",
        industry: company.industry ?? null,
        businessDescription: company.business_description ?? null,
        revenueStage: company.revenue_stage ?? null,
        fundingAmount: company.funding_amount ? Number(company.funding_amount) : null,
        geography: [company.state, company.country].filter(Boolean).join(", ") || null,
      }
    : undefined;

  if (!room) notFound();

  return (
    <FounderAppShell profileName={profile.full_name ?? profile.email ?? "Founder"} profileSubtitle="Deal room">
      <FounderFeatureGate featureKey="investor_access">
        <div className="space-y-6">
          <PageHeader
            eyebrow="Deal room"
            title={room.title}
            description="Respond to investor diligence questions and document requests. Educational/diligence collaboration only."
            metadata={`status: ${room.status}`}
          />

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Educational/diligence collaboration only. No legal, tax, or investment advice. No funding commitments.
          </div>

          <DealRoomMilestonePanel
            room={room}
            questions={(questions ?? []).map((q) => ({
              id: q.id,
              status: q.status ?? "",
              category: q.category ?? "",
              question: q.question ?? "",
              created_at: String(q.created_at ?? ""),
              responded_at: q.responded_at ? String(q.responded_at) : null,
            }))}
            docRequests={(docRequests ?? []).map((d) => ({
              id: d.id,
              status: d.status ?? "",
              request_type: d.request_type ?? "",
              custom_request: d.custom_request ?? null,
              created_at: String(d.created_at ?? ""),
              fulfilled_at: d.fulfilled_at ? String(d.fulfilled_at) : null,
            }))}
            activity={(activity ?? []).map((e) => ({
              id: e.id,
              event_type: String(e.event_type ?? ""),
              created_at: String(e.created_at ?? ""),
            }))}
          />

          <section className="grid gap-6 xl:grid-cols-2">
            <WorkspacePanel title="Investor questions" subtitle={`${(questions ?? []).length} recent`}>
              <DealRoomQuestionsPanel
                roomId={roomId}
                viewerRole="founder"
                initialQuestions={questions ?? []}
                companySnapshot={companySnapshot}
              />
            </WorkspacePanel>
            <WorkspacePanel title="Document requests" subtitle={`${(docRequests ?? []).length} recent`}>
              <DealRoomDocRequestsPanel
                roomId={roomId}
                viewerRole="founder"
                initialRequests={docRequests ?? []}
                founderDocuments={(documents ?? []).map((d) => ({
                  id: d.id,
                  file_name: d.file_name ?? null,
                  document_type: d.document_type ?? null,
                }))}
              />
            </WorkspacePanel>
          </section>

          <WorkspacePanel title="Collaboration" subtitle="Discussion thread">
            <CollaborationDiscussionPanel entityType="deal_room" entityId={roomId} />
          </WorkspacePanel>

          <DealRoomActivityPanel roomId={roomId} />
        </div>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}

