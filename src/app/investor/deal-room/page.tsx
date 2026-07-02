import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  active:    { label: "Active",    dot: "bg-emerald-400", bg: "bg-emerald-50",  text: "text-emerald-700" },
  pending:   { label: "Pending",   dot: "bg-amber-400",   bg: "bg-amber-50",    text: "text-amber-700" },
  closed:    { label: "Closed",    dot: "bg-slate-400",   bg: "bg-slate-100",   text: "text-slate-600" },
  archived:  { label: "Archived",  dot: "bg-slate-300",   bg: "bg-slate-100",   text: "text-slate-500" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${cfg.bg} ${cfg.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

export default async function InvestorDealRoomIndexPage() {
  const profile = await requireRole(["investor"]);
  const t = await getTranslations("appPages");
  const supabase = await createServerSupabaseClient();
  const admin = createServiceRoleClient();

  // 1. Load deal rooms for this investor
  const { data: rooms } = await supabase
    .from("deal_rooms")
    .select("id, title, status, updated_at, created_at, company_id")
    .eq("investor_user_id", profile.id)
    .order("updated_at", { ascending: false })
    .limit(200);

  const roomList = rooms ?? [];
  const roomIds = roomList.map((r) => r.id);
  const companyIds = [...new Set(roomList.map((r) => r.company_id).filter(Boolean))];

  // 2. Enrich: company names + unanswered question counts (parallel)
  const [companiesResult, questionsResult] = await Promise.all([
    companyIds.length > 0
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (admin as any).from("companies").select("id, company_name").in("id", companyIds)
      : Promise.resolve({ data: [] }),
    roomIds.length > 0
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (admin as any)
          .from("deal_room_questions")
          .select("room_id, id")
          .in("room_id", roomIds)
          .is("founder_response", null)
      : Promise.resolve({ data: [] }),
  ]);

  const companyNameById = new Map<string, string>(
    ((companiesResult as { data: Array<{ id: string; company_name: string }> | null }).data ?? []).map(
      (c) => [c.id, c.company_name],
    ),
  );

  const unansweredByRoom = new Map<string, number>();
  for (const q of ((questionsResult as { data: Array<{ room_id: string }> | null }).data ?? [])) {
    unansweredByRoom.set(q.room_id, (unansweredByRoom.get(q.room_id) ?? 0) + 1);
  }

  // Counts for header
  const activeCount = roomList.filter((r) => r.status === "active").length;

  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle={t("investor_account")}
    >
      <div className="space-y-6">
        <PageHeader
          eyebrow={t("deal_room")}
          title={t("founder_deal_rooms")}
          description={t("structured_diligence_collaboration_no_public_a")}
          metadata={`${roomList.length} room${roomList.length !== 1 ? "s" : ""}${activeCount > 0 ? ` · ${activeCount} active` : ""}`}
        />

        {roomList.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" stroke="#534AB7" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="17 21 17 13 7 13 7 21" stroke="#534AB7" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="7 3 7 8 15 8" stroke="#534AB7" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="mb-2 text-base font-bold text-slate-900">{t("no_deal_rooms_yet")}</p>
            <p className="mx-auto mb-6 max-w-sm text-sm text-slate-500 leading-relaxed">
              Deal rooms open automatically when you express interest in a company and the founder enables structured diligence.
            </p>
            <Link
              href="/investor/opportunities"
              className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Browse opportunities →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {roomList.map((room) => {
              const companyName = companyNameById.get(room.company_id ?? "") ?? null;
              const unanswered = unansweredByRoom.get(room.id) ?? 0;
              const updatedAt = new Date(String(room.updated_at));
              // eslint-disable-next-line react-hooks/purity
              const isRecent = Date.now() - updatedAt.getTime() < 7 * 24 * 60 * 60 * 1000;

              return (
                <div
                  key={room.id}
                  className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  {/* Company icon */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 font-bold text-sm">
                    {(companyName ?? room.title).slice(0, 2).toUpperCase()}
                  </div>

                  {/* Main info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900">{room.title}</p>
                      <StatusBadge status={room.status} />
                      {isRecent && (
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600">
                          Recent
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {companyName ? (
                        <span className="font-medium text-slate-600">{companyName}</span>
                      ) : null}
                      {companyName ? " · " : ""}
                      Updated {updatedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>

                  {/* Unanswered badge */}
                  {unanswered > 0 && (
                    <div className="shrink-0 text-center">
                      <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-amber-100 px-1.5 text-xs font-bold text-amber-700">
                        {unanswered}
                      </span>
                      <p className="mt-0.5 text-[10px] text-slate-400">pending</p>
                    </div>
                  )}

                  {/* CTA */}
                  <Link
                    href={`/investor/deal-room/${room.id}`}
                    className="shrink-0 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 group-hover:border-indigo-300"
                  >
                    Open →
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
