import Link from "next/link";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { DealRoomActivityFeed, type ActivityEvent } from "@/components/founder/DealRoomActivityFeed";

export const dynamic = "force-dynamic";

export default async function FounderDealRoomIndexPage() {
  const profile = await requireRole(["founder"]);
  const company = await ensureFounderCompanyForUser(profile);
  const supabase = await createServerSupabaseClient();

  const { data: rooms } = company
    ? await supabase
        .from("deal_rooms")
        .select("id, title, status, updated_at, created_at")
        .eq("company_id", company.id)
        .order("updated_at", { ascending: false })
        .limit(200)
    : { data: [] as Array<{ id: string; title: string; status: string; updated_at: string; created_at: string }> };

  // Fetch lightweight counts for milestone display
  const roomIds = (rooms ?? []).map((r) => r.id);
  const [{ data: qCounts }, { data: dCounts }, { data: aCounts }, { data: recentActivity }] =
    roomIds.length > 0
      ? await Promise.all([
          supabase.from("deal_room_questions").select("room_id, status").in("room_id", roomIds),
          supabase.from("deal_room_document_requests").select("room_id, status").in("room_id", roomIds),
          supabase.from("deal_room_activity_events").select("room_id, event_type").in("room_id", roomIds),
          supabase
            .from("deal_room_activity_events")
            .select("id, room_id, event_type, created_at, metadata")
            .in("room_id", roomIds)
            .order("created_at", { ascending: false })
            .limit(20),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  // Build room title lookup
  const roomTitles: Record<string, string> = {};
  for (const r of rooms ?? []) roomTitles[r.id] = r.title;

  const activityEvents: ActivityEvent[] = (recentActivity ?? []).map((ev) => ({
    id: String(ev.id),
    room_id: String(ev.room_id),
    room_title: roomTitles[String(ev.room_id)] ?? "Unknown room",
    event_type: ev.event_type as ActivityEvent["event_type"],
    created_at: String(ev.created_at),
    metadata: (ev.metadata as Record<string, unknown> | null) ?? null,
  }));

  function getRoomStep(roomId: string, roomStatus: string): 1 | 2 | 3 | 4 | 5 {
    if (roomStatus === "closed" || roomStatus === "archived") return 5;
    const qs = (qCounts ?? []).filter((q) => q.room_id === roomId);
    const ds = (dCounts ?? []).filter((d) => d.room_id === roomId);
    const as_ = (aCounts ?? []).filter((a) => a.room_id === roomId);
    const allQResolved = qs.length > 0 && qs.every((q) => q.status === "resolved");
    const allDocsOk = ds.every((d) => d.status === "fulfilled" || d.status === "cancelled");
    if (allQResolved && allDocsOk && (qs.length > 0 || ds.length > 0)) return 4;
    const hasEngagement = qs.length > 0 || ds.length > 0 || as_.some((a) => ["question_created", "doc_requested", "room_viewed"].includes(String(a.event_type)));
    if (hasEngagement) return 3;
    const viewed = as_.some((a) => a.event_type === "room_viewed");
    if (viewed) return 2;
    return 1;
  }

  return (
    <FounderAppShell profileName={profile.full_name ?? profile.email ?? "Founder"} profileSubtitle={company?.company_name ?? "Your company"}>
      <FounderFeatureGate featureKey="investor_access">
        <div className="space-y-6">
          <PageHeader
            eyebrow="Deal room"
            title="Investor deal rooms"
            description="Structured diligence collaboration. No public access. No legal or investment advice."
            metadata={`${(rooms ?? []).length} rooms`}
          />

          <WorkspacePanel title="Rooms" subtitle="Your company deal rooms">
            {(rooms ?? []).length === 0 ? (
              <p className="text-sm text-slate-600">No deal rooms yet.</p>
            ) : (
              <div className="space-y-4">
                {(rooms ?? []).map((r) => {
                  const step = getRoomStep(r.id, r.status);
                  const STAGES = ["Room created", "Investor engaged", "Under review", "Diligence done", "Closed"];
                  const progressW = `${((step - 1) / 4) * 80}%`;
                  return (
                    <div key={r.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                      <div style={{ height: 3, background: "#534AB7" }} />
                      <div className="p-4">
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{r.title}</p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              Updated {new Date(String(r.updated_at)).toLocaleDateString("en-US")}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span
                              className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                              style={{ background: "#EEEDFE", color: "#3C3489" }}
                            >
                              {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                            </span>
                            <Link
                              href={`/founder/deal-room/${r.id}`}
                              className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                            >
                              Open →
                            </Link>
                          </div>
                        </div>

                        {/* Mini milestone track */}
                        <div className="relative flex items-start">
                          <div style={{ position: "absolute", top: 10, left: "10%", width: "80%", height: 2, background: "#e5e7eb" }} />
                          <div style={{ position: "absolute", top: 10, left: "10%", width: progressW, height: 2, background: "#534AB7" }} />
                          {STAGES.map((label, i) => {
                            const nodeStep = i + 1;
                            const done = nodeStep < step;
                            const active = nodeStep === step;
                            return (
                              <div key={label} className="flex flex-1 flex-col items-center gap-1" style={{ minWidth: 0 }}>
                                <div
                                  style={{
                                    width: 20, height: 20, borderRadius: "50%", position: "relative", zIndex: 1,
                                    background: done || active ? "#534AB7" : "#f1f5f9",
                                    border: done || active ? "none" : "1.5px solid #e2e8f0",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                  }}
                                >
                                  {done ? (
                                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                                      <path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  ) : active ? (
                                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "white" }} />
                                  ) : null}
                                </div>
                                <p
                                  className="truncate text-center"
                                  style={{ fontSize: 10, maxWidth: "100%", color: active || done ? "#534AB7" : "#94a3b8", fontWeight: active ? 500 : 400 }}
                                >
                                  {label}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </WorkspacePanel>

          {/* Activity feed */}
          <WorkspacePanel
            title="Activity feed"
            subtitle="Recent investor engagement across all rooms"
          >
            <DealRoomActivityFeed events={activityEvents} />
          </WorkspacePanel>
        </div>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}

