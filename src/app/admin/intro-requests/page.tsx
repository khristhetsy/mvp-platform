import { AppShell } from "@/components/AppShell";
import { AdminIntroQueue } from "@/components/admin/AdminIntroQueue";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { formatError } from "@/lib/errors/format-error";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

type IntroStatusFilter = "all" | "pending" | "facilitated" | "declined";

export default async function AdminIntroRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const profile = await requireRole(["admin", "analyst"]);
  const { filter: rawFilter } = await searchParams;
  const filter: IntroStatusFilter =
    rawFilter === "pending" || rawFilter === "facilitated" || rawFilter === "declined"
      ? rawFilter
      : "all";

  let loadError: string | null = null;
  let introRequests: Array<Record<string, unknown>> = [];

  try {
    const admin = createServiceRoleClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (admin as any)
      .from("intro_requests")
      .select(
        "id, status, message, facilitator_note, facilitated_at, created_at, updated_at, profiles!investor_id(full_name, email), companies(company_name, id)",
      )
      .order("created_at", { ascending: false });

    const { data, error } = result as {
      data: Array<Record<string, unknown>> | null;
      error: unknown;
    };
    if (error) throw error;
    introRequests = data ?? [];
  } catch (error) {
    loadError = formatError(error);
  }

  // Compute counts before filtering
  const totalCount = introRequests.length;
  const pendingCount = introRequests.filter((r) => {
    const s = r.status as string | null;
    return s === "requested" || s === "reviewing";
  }).length;
  const facilitatedCount = introRequests.filter((r) => r.status === "facilitated").length;
  const declinedCount = introRequests.filter((r) => r.status === "declined").length;

  // Apply filter
  const filtered =
    filter === "all"
      ? introRequests
      : filter === "pending"
        ? introRequests.filter((r) => {
            const s = r.status as string | null;
            return s === "requested" || s === "reviewing";
          })
        : introRequests.filter((r) => r.status === filter);

  const FILTER_TABS: { key: IntroStatusFilter; label: string; count: number }[] = [
    { key: "all",         label: "All",         count: totalCount      },
    { key: "pending",     label: "Pending",      count: pendingCount    },
    { key: "facilitated", label: "Facilitated",  count: facilitatedCount },
    { key: "declined",    label: "Declined",     count: declinedCount   },
  ];

  void profile;

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle="Admin account"
    >
      <WorkspacePageContainer>
        <PageHeader
          eyebrow="Investor Relations"
          title="Intro requests"
          description="Review, facilitate, or decline investor intro requests. Notifications are sent automatically on status change."
        />

        {loadError ? (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            Failed to load intro requests: {loadError}
          </div>
        ) : null}

        {/* Filter tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          {FILTER_TABS.map(({ key, label, count }) => {
            const isActive = filter === key;
            return (
              <a
                key={key}
                href={key === "all" ? "/admin/intro-requests" : `/admin/intro-requests?filter=${key}`}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    isActive ? "bg-white/20 text-white" : "bg-white text-slate-500"
                  }`}
                >
                  {count}
                </span>
              </a>
            );
          })}
        </div>

        <AdminIntroQueue introRequests={filtered} />
      </WorkspacePageContainer>
    </AppShell>
  );
}
