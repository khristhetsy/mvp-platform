import { FounderAppShell } from "@/components/FounderAppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { getTranslations } from "next-intl/server";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { loadFounderMilestones, type MilestoneCategory, type MilestoneResult } from "@/lib/data/founder-milestones";

export const dynamic = "force-dynamic";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatProgress(m: MilestoneResult): string {
  if (!m.progress) return "";
  const { current, target, unit } = m.progress;
  if (unit === "$") {
    const fmt = (n: number) =>
      n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K` : `$${n}`;
    return `${fmt(current)} / ${fmt(target)}`;
  }
  if (unit === "%") return `${current}% / ${target}%`;
  return `${current} / ${target} ${unit}`;
}

// ─── Category icons ──────────────────────────────────────────────────────────

function CategoryIcon({ id }: { id: string }) {
  const style = { color: "#534AB7" };
  if (id === "profile") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
      </svg>
    );
  }
  if (id === "documents") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    );
  }
  if (id === "readiness") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden>
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    );
  }
  if (id === "investors") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }
  // fundraising
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden>
      <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

// ─── Milestone row icon ───────────────────────────────────────────────────────

function MilestoneRowIcon({ id, achieved }: { id: string; achieved: boolean }) {
  const color = achieved ? "#534AB7" : "#94a3b8";

  const icons: Record<string, React.ReactElement> = {
    profile_started: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
      </svg>
    ),
    profile_complete: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
    logo_uploaded: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
      </svg>
    ),
    listing_published: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
    first_document: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
      </svg>
    ),
    pitch_deck: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
    financial_model: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /><path d="M3 15h18" /><path d="M9 3v18" />
      </svg>
    ),
    five_documents: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    ),
    first_deal_room: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
    first_pledge: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  };

  const path = icons[id] ?? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
    </svg>
  );

  return (
    <div
      style={{
        background: achieved ? "#EEEDFE" : "#f1f5f9",
        color,
        flexShrink: 0,
      }}
      className="flex h-8 w-8 items-center justify-center rounded-lg"
    >
      {path}
    </div>
  );
}

// ─── Milestone row ────────────────────────────────────────────────────────────

function MilestoneRow({ milestone }: { milestone: MilestoneResult }) {
  const achieved = milestone.status === "achieved";
  const progressStr = formatProgress(milestone);

  return (
    <div className="flex items-start gap-4 border-b border-slate-100 py-4 last:border-0">
      {/* Icon */}
      <MilestoneRowIcon id={milestone.id} achieved={achieved} />

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <p className={`text-sm font-semibold ${achieved ? "text-slate-900" : "text-slate-500"}`}>
            {milestone.label}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            {achieved ? (
              <>
                {milestone.achievedAt ? (
                  <span className="text-[11px] text-slate-400">{formatDate(milestone.achievedAt)}</span>
                ) : null}
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                  style={{ background: "#EEEDFE", color: "#534AB7" }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Achieved
                </span>
              </>
            ) : (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-400">
                Not started
              </span>
            )}
          </div>
        </div>

        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{milestone.description}</p>

        {/* Progress bar */}
        {milestone.progress && !achieved ? (
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.round((milestone.progress.current / milestone.progress.target) * 100)}%`,
                  background: "#534AB7",
                }}
              />
            </div>
            <span className="shrink-0 text-[10px] font-medium text-slate-400">{progressStr}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Category section ─────────────────────────────────────────────────────────

function CategorySection({ category }: { category: MilestoneCategory }) {
  const achievedCount = category.milestones.filter((m) => m.status === "achieved").length;
  const total = category.milestones.length;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Category header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ background: "#EEEDFE" }}
          >
            <CategoryIcon id={category.id} />
          </div>
          <h2 className="text-sm font-semibold text-slate-900">{category.label}</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">
            {achievedCount}/{total}
          </span>
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.round((achievedCount / total) * 100)}%`,
                background: "#534AB7",
              }}
            />
          </div>
        </div>
      </div>

      {/* Milestones */}
      <div className="px-5">
        {category.milestones.map((m) => (
          <MilestoneRow key={m.id} milestone={m} />
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function FounderMilestonesPage() {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("appPages");
  const supabase = await createServerSupabaseClient();
  const serviceSupabase = createServiceRoleClient();
  const company = await ensureFounderCompanyForUser(profile);

  const categories = await loadFounderMilestones(supabase, serviceSupabase, company, profile.id);

  const allMilestones = categories.flatMap((c) => c.milestones);
  const totalAchieved = allMilestones.filter((m) => m.status === "achieved").length;
  const totalCount = allMilestones.length;
  const pct = Math.round((totalAchieved / totalCount) * 100);

  return (
    <FounderAppShell>
      <WorkspacePageContainer>
        <PageHeader
          eyebrow={t("progress")}
          title={t("milestones")}
          description={t("track_your_fundraising_journey_from_setting_up")}
        />

        {/* Summary bar */}
        <div className="mb-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div style={{ height: 3, background: "linear-gradient(90deg,#534AB7,#7c3aed,#06b6d4)" }} />
          <div className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {totalAchieved}
                <span className="ml-1 text-base font-medium text-slate-400">/ {totalCount}</span>
              </p>
              <p className="mt-0.5 text-sm text-slate-500">milestones achieved</p>
            </div>
            <div className="flex-1 sm:max-w-sm">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">{t("overall_progress")}</span>
                <span className="text-xs font-semibold" style={{ color: "#534AB7" }}>{pct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: "linear-gradient(90deg,#534AB7,#7c3aed)" }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Categories */}
        <div className="space-y-5">
          {categories.map((cat) => (
            <CategorySection key={cat.id} category={cat} />
          ))}
        </div>
      </WorkspacePageContainer>
    </FounderAppShell>
  );
}
