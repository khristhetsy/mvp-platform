import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  CAPITAL_STAGE_META,
  CAPITAL_STAGE_MODULES,
  computeCapitalStageAccess,
  computeCapitalStagePercent,
  type CapitalStage,
} from "@/lib/learning/capital-stages";

export const dynamic = "force-dynamic";

const STAGES: CapitalStage[] = ["stage_0", "stage_1", "stage_2", "stage_3"];

const STAGE_LABEL_SHORT: Record<CapitalStage, string> = {
  stage_0: "Stage 0",
  stage_1: "Stage 1",
  stage_2: "Stage 2",
  stage_3: "Stage 3",
};

type ProfileRow = { id: string; full_name: string | null; email: string | null };
type ProgressRow = { founder_id: string; module_slug: string; lesson_id: string; status: string };
type OverrideRow = { founder_id: string; capital_stage: string; is_unlocked: boolean };

export default async function AdminLearningFoundersPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const admin = createServiceRoleClient();

  // Load all founders
  const { data: rawFounders } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .eq("role", "founder")
    .order("full_name", { ascending: true });

  const founders = (rawFounders ?? []) as ProfileRow[];
  const founderIds = founders.map((f) => f.id);

  // Load lesson progress for all founders
  const { data: rawProgress } = founderIds.length
    ? await admin
        .from("founder_lesson_progress")
        .select("founder_id, module_slug, lesson_id, status")
        .in("founder_id", founderIds)
        .eq("status", "completed")
    : { data: [] };

  const allProgress = (rawProgress ?? []) as ProgressRow[];

  // Load stage overrides
  const { data: rawOverrides } = founderIds.length
    ? await (admin as unknown as { from: (t: string) => { select: (s: string) => { in: (col: string, vals: string[]) => Promise<{ data: unknown[] | null }> } } })
        .from("admin_learning_stage_overrides")
        .select("founder_id, capital_stage, is_unlocked")
        .in("founder_id", founderIds)
    : { data: [] };

  const allOverrides = (rawOverrides ?? []) as OverrideRow[];

  // Load company names via user_companies
  const { data: userCompaniesRaw } = founderIds.length
    ? await admin
        .from("user_companies")
        .select("user_id, company_id, companies(company_name)")
        .in("user_id", founderIds)
    : { data: [] };

  type UcRow = { user_id: string; company_id: string; companies: { company_name: string } | null };
  const userCompanies = (userCompaniesRaw ?? []) as unknown as UcRow[];
  const companyByFounder = new Map(
    userCompanies.map((uc) => [uc.user_id, uc.companies?.company_name ?? "—"]),
  );

  // Group progress by founder
  const progressByFounder = new Map<string, Set<string>>();
  for (const row of allProgress) {
    if (!progressByFounder.has(row.founder_id)) {
      progressByFounder.set(row.founder_id, new Set());
    }
    progressByFounder.get(row.founder_id)!.add(`${row.module_slug}:${row.lesson_id}`);
  }

  // Group overrides by founder
  const overridesByFounder = new Map<string, Partial<Record<CapitalStage, boolean>>>();
  for (const row of allOverrides) {
    if (!overridesByFounder.has(row.founder_id)) {
      overridesByFounder.set(row.founder_id, {});
    }
    overridesByFounder.get(row.founder_id)![row.capital_stage as CapitalStage] = row.is_unlocked;
  }

  const totalLessons = CAPITAL_STAGE_MODULES.reduce((s, m) => s + m.lessons.length, 0);

  type FounderRow = {
    id: string;
    name: string;
    email: string;
    company: string;
    currentStage: CapitalStage;
    stageLabel: string;
    overallPct: number;
    rating: number;
    completedCount: number;
    riskLevel: "ok" | "slow" | "at_risk";
  };

  const founderRows: FounderRow[] = founders.map((f) => {
    const completedKeys = progressByFounder.get(f.id) ?? new Set<string>();
    const overrides = overridesByFounder.get(f.id) ?? {};
    const stageAccess = computeCapitalStageAccess(completedKeys, overrides);

    const stagePercents = Object.fromEntries(
      STAGES.map((s) => [s, computeCapitalStagePercent(s, completedKeys)]),
    ) as Record<CapitalStage, number>;

    const currentStage = [...STAGES].reverse().find((s) => stageAccess[s]) ?? "stage_0";
    const overallPct = Math.round((completedKeys.size / Math.max(totalLessons, 1)) * 100);

    const rating = Math.round(
      stagePercents.stage_0 * 0.25 +
      stagePercents.stage_1 * 0.35 +
      stagePercents.stage_2 * 0.25 +
      stagePercents.stage_3 * 0.15,
    );

    const riskLevel: "ok" | "slow" | "at_risk" =
      completedKeys.size === 0 ? "at_risk" : overallPct < 20 ? "at_risk" : overallPct < 50 ? "slow" : "ok";

    return {
      id: f.id,
      name: f.full_name ?? f.email ?? "Unknown",
      email: f.email ?? "",
      company: companyByFounder.get(f.id) ?? "—",
      currentStage,
      stageLabel: STAGE_LABEL_SHORT[currentStage],
      overallPct,
      rating,
      completedCount: completedKeys.size,
      riskLevel,
    };
  });

  const atRiskCount = founderRows.filter((r) => r.riskLevel === "at_risk").length;
  const avgRating = founderRows.length
    ? Math.round(founderRows.reduce((s, r) => s + r.rating, 0) / founderRows.length)
    : 0;
  const stage2Count = founderRows.filter((r) => r.currentStage === "stage_2" || r.currentStage === "stage_3").length;

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
          eyebrow="Learning operations"
          title="Founder roster"
          description="All founders — stage, progress, readiness rating, and risk flags."
          actions={
            <Link
              href="/admin/learning"
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              ← Learning overview
            </Link>
          }
        />

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Active founders", value: founderRows.length },
            { label: "At risk", value: atRiskCount, color: atRiskCount > 0 ? "text-red-600" : "text-slate-900" },
            { label: "Avg rating", value: avgRating, suffix: "/ 100", color: "text-indigo-700" },
            { label: "Stage 2+ unlocked", value: stage2Count, color: "text-green-700" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
              <p className={`text-2xl font-bold ${stat.color ?? "text-slate-900"}`}>
                {stat.value}
                {stat.suffix && <span className="text-sm font-normal text-slate-400"> {stat.suffix}</span>}
              </p>
              <p className="mt-1 text-xs text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Founders</h2>
            <p className="mt-0.5 text-xs text-slate-500">Click a row to manage stage access and lesson assignments</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {["Founder", "Company", "Stage", "Progress", "Rating", "Lessons done", "Risk"].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                      {h}
                    </th>
                  ))}
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {founderRows.map((row) => {
                  const stageMeta = CAPITAL_STAGE_META[row.currentStage];
                  const riskConfig = {
                    ok: { label: "On track", bg: "bg-green-50", text: "text-green-700" },
                    slow: { label: "Slow", bg: "bg-amber-50", text: "text-amber-700" },
                    at_risk: { label: "At risk", bg: "bg-red-50", text: "text-red-600" },
                  }[row.riskLevel];
                  return (
                    <tr key={row.id} className="group transition hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900">{row.name}</p>
                        <p className="text-xs text-slate-400">{row.email}</p>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">{row.company}</td>
                      <td className="px-5 py-4">
                        <span
                          className="inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold"
                          style={{ background: stageMeta.bgColor, color: stageMeta.color }}
                        >
                          {row.stageLabel}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${row.overallPct}%`,
                                background: row.overallPct >= 80 ? "#3B6D11" : "#534AB7",
                              }}
                            />
                          </div>
                          <span className="text-xs text-slate-600">{row.overallPct}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-semibold" style={{ color: row.rating >= 70 ? "#3B6D11" : row.rating >= 40 ? "#534AB7" : "#B91C1C" }}>
                        {row.rating}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">{row.completedCount}</td>
                      <td className="px-5 py-4">
                        <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${riskConfig.bg} ${riskConfig.text}`}>
                          {riskConfig.label}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <Link
                          href={`/admin/learning/founders/${row.id}`}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 opacity-0 transition hover:bg-indigo-50 group-hover:opacity-100"
                        >
                          Manage →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {founderRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-sm text-slate-400">
                      No founders enrolled in the learning program yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </WorkspacePageContainer>
    </AppShell>
  );
}
