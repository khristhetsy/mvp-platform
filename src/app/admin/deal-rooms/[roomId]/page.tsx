import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { CollaborationDiscussionPanel } from "@/components/collaboration/CollaborationDiscussionPanel";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ roomId: string }> };

export default async function AdminDealRoomDetailPage({ params }: PageProps) {
  const profile = await requireRole(["admin", "analyst"]);
  const { roomId } = await params;
  const supabase = createServiceRoleClient();

  const [roomRes, questionsRes, docsRes, activityRes] = await Promise.all([
    supabase.from("deal_rooms").select("*").eq("id", roomId).maybeSingle(),
    supabase.from("deal_room_questions").select("*").eq("room_id", roomId).order("created_at", { ascending: false }).limit(200),
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

  const room = roomRes.data;
  if (!room) {
    return (
      <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role}>
        <WorkspacePageContainer>
          <PageHeader eyebrow="Deal rooms" title="Deal room not found" description="Invalid room id." />
        </WorkspacePageContainer>
      </AppShell>
    );
  }

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role}>
      <WorkspacePageContainer>
        <PageHeader
          eyebrow="Deal room"
          title={room.title}
          description="Admin oversight view. Educational/diligence collaboration only."
          actions={
            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/deal-rooms"
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Back
              </Link>
              <a
                href={`/api/admin/deal-rooms/${roomId}/ai-summary`}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                AI summary
              </a>
            </div>
          }
        />

        <section className="grid gap-6 xl:grid-cols-2">
          <WorkspacePanel title="Questions" subtitle={`${(questionsRes.data ?? []).length} recent`}>
            {(questionsRes.data ?? []).length === 0 ? (
              <p className="text-sm text-slate-600">No questions yet.</p>
            ) : (
              <div className="space-y-3">
                {(questionsRes.data ?? []).map((q) => (
                  <div key={q.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {q.category} · {q.status}
                    </p>
                    <p className="mt-1 font-medium text-slate-900">{q.question}</p>
                    {q.founder_response ? (
                      <p className="mt-2 text-slate-700">
                        <span className="font-semibold">Founder:</span> {q.founder_response}
                      </p>
                    ) : (
                      <p className="mt-2 text-slate-500">No founder response yet.</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </WorkspacePanel>

          <WorkspacePanel title="Document requests" subtitle={`${(docsRes.data ?? []).length} recent`}>
            {(docsRes.data ?? []).length === 0 ? (
              <p className="text-sm text-slate-600">No document requests yet.</p>
            ) : (
              <div className="space-y-3">
                {(docsRes.data ?? []).map((r) => (
                  <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {r.request_type} · {r.status}
                    </p>
                    {r.custom_request ? <p className="mt-1 text-slate-700">{r.custom_request}</p> : null}
                    {r.founder_note ? (
                      <p className="mt-2 text-slate-700">
                        <span className="font-semibold">Founder note:</span> {r.founder_note}
                      </p>
                    ) : null}
                    {r.fulfilled_document_id ? (
                      <p className="mt-2 text-xs text-slate-500">Fulfilled doc: {String(r.fulfilled_document_id).slice(0, 8)}…</p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </WorkspacePanel>
        </section>

        <WorkspacePanel title="Activity timeline" subtitle="Latest events">
          {(activityRes.data ?? []).length === 0 ? (
            <p className="text-sm text-slate-600">No activity yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {(activityRes.data ?? []).map((e) => (
                <div key={e.id} className="flex flex-col gap-0.5 py-2 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <span className="font-semibold break-words">{e.event_type}</span>
                  <span className="shrink-0 text-xs text-slate-500">{new Date(String(e.created_at)).toLocaleString("en-US")}</span>
                </div>
              ))}
            </div>
          )}
        </WorkspacePanel>

        <WorkspacePanel title="Collaboration" subtitle="Comments & internal notes">
          <CollaborationDiscussionPanel
            entityType="deal_room"
            entityId={roomId}
            threadContext={{
              companyId: room.company_id,
              investorProfileId: room.investor_profile_id,
              spvId: room.spv_id,
            }}
          />
        </WorkspacePanel>
      </WorkspacePageContainer>
    </AppShell>
  );
}

