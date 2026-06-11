import { notFound } from "next/navigation";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DealRoomQuestionsPanel } from "@/components/deal-room/DealRoomQuestionsPanel";
import { DealRoomDocRequestsPanel } from "@/components/deal-room/DealRoomDocRequestsPanel";
import { CollaborationDiscussionPanel } from "@/components/collaboration/CollaborationDiscussionPanel";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ roomId: string }> };

export default async function FounderDealRoomPage({ params }: PageProps) {
  const profile = await requireRole(["founder"]);
  const { roomId } = await params;
  const supabase = await createServerSupabaseClient();

  const [{ data: room }, { data: questions }, { data: docRequests }, { data: activity }] = await Promise.all([
    supabase.from("deal_rooms").select("id, title, status").eq("id", roomId).maybeSingle(),
    supabase.from("deal_room_questions").select("*").eq("room_id", roomId).order("created_at", { ascending: false }).limit(200),
    supabase.from("deal_room_document_requests").select("*").eq("room_id", roomId).order("created_at", { ascending: false }).limit(200),
    supabase.from("deal_room_activity_events").select("*").eq("room_id", roomId).order("created_at", { ascending: false }).limit(200),
  ]);

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

          <section className="grid gap-6 xl:grid-cols-2">
            <WorkspacePanel title="Investor questions" subtitle={`${(questions ?? []).length} recent`}>
              <DealRoomQuestionsPanel roomId={roomId} viewerRole="founder" initialQuestions={questions ?? []} />
            </WorkspacePanel>
            <WorkspacePanel title="Document requests" subtitle={`${(docRequests ?? []).length} recent`}>
              <DealRoomDocRequestsPanel roomId={roomId} viewerRole="founder" initialRequests={docRequests ?? []} />
            </WorkspacePanel>
          </section>

          <WorkspacePanel title="Activity timeline" subtitle="Latest room events">
            {(activity ?? []).length === 0 ? (
              <p className="text-sm text-slate-600">No activity yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {(activity ?? []).map((e) => (
                  <div key={e.id} className="flex flex-col gap-0.5 py-2 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <span className="font-semibold break-words">{e.event_type}</span>
                    <span className="shrink-0 text-xs text-slate-500">{new Date(String(e.created_at)).toLocaleString("en-US")}</span>
                  </div>
                ))}
              </div>
            )}
          </WorkspacePanel>

          <WorkspacePanel title="Collaboration" subtitle="Discussion thread">
            <CollaborationDiscussionPanel entityType="deal_room" entityId={roomId} />
          </WorkspacePanel>
        </div>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}

