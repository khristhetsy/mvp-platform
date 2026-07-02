import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { requireRole } from "@/lib/supabase/auth";
import { getTranslations } from "next-intl/server";
import { AdminDealRoomCreatePanel } from "@/components/admin/deal-rooms/AdminDealRoomCreatePanel";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminDealRoomsPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const t = await getTranslations("irAdmin.dealRooms");
  const supabase = createServiceRoleClient();

  const [
    { data: rooms },
    { data: companies },
    { data: investorProfiles },
    activeCount,
    unresolvedQuestions,
    unresolvedDocs,
  ] = await Promise.all([
    supabase
      .from("deal_rooms")
      .select("id, title, status, company_id, investor_profile_id, updated_at, created_at")
      .order("updated_at", { ascending: false })
      .limit(200),
    supabase.from("companies").select("id, company_name").order("company_name", { ascending: true }).limit(500),
    supabase
      .from("investor_profiles")
      .select("id, firm_name, profiles(full_name, email)")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("deal_rooms").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase
      .from("deal_room_questions")
      .select("id", { count: "exact", head: true })
      .neq("status", "resolved"),
    supabase
      .from("deal_room_document_requests")
      .select("id", { count: "exact", head: true })
      .neq("status", "fulfilled")
      .neq("status", "cancelled"),
  ]);

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
          profileEmail={profile.email ?? undefined}
    >
      <WorkspacePageContainer>
        <PageHeader
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("desc")}
          metadata="Admin oversight · structured questions · document requests · timeline"
        />

        <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Active rooms" value={String(activeCount.count ?? 0)} detail="status=active" accent="indigo" />
          <MetricCard
            label="Unresolved questions"
            value={String(unresolvedQuestions.count ?? 0)}
            detail="deal_room_questions"
            accent="violet"
          />
          <MetricCard
            label="Unresolved doc requests"
            value={String(unresolvedDocs.count ?? 0)}
            detail="deal_room_document_requests"
            accent="blue"
          />
          <MetricCard label="Total rooms" value={String((rooms ?? []).length)} detail="latest 200" accent="slate" />
        </section>

        <WorkspacePanel title="Create deal room" subtitle="Staff only · links company + investor">
          <AdminDealRoomCreatePanel
            companies={(companies ?? []).map((c) => ({ id: c.id, company_name: c.company_name }))}
            investors={(investorProfiles ?? []).map((row) => {
              const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
              const label =
                profile?.full_name?.trim() ||
                profile?.email?.trim() ||
                `Investor ${String(row.id).slice(0, 8)}`;
              return {
                id: row.id,
                firm_name: row.firm_name,
                profileLabel: label,
              };
            })}
          />
        </WorkspacePanel>

        <WorkspacePanel title="Rooms" subtitle={`${(rooms ?? []).length} recent`} className="mt-6">
          {(rooms ?? []).length === 0 ? (
            <p className="text-sm text-slate-600">No deal rooms yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {(rooms ?? []).map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{r.title}</p>
                    <p className="truncate text-xs text-slate-500">
                      status: {r.status} · updated {new Date(String(r.updated_at)).toLocaleDateString("en-US")}
                    </p>
                  </div>
                  <Link
                    href={`/admin/deal-rooms/${r.id}`}
                    className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Open
                  </Link>
                </div>
              ))}
            </div>
          )}
        </WorkspacePanel>
      </WorkspacePageContainer>
    </AppShell>
  );
}

