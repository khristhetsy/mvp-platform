import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { AdminReadinessDashboard } from "@/components/admin/AdminReadinessDashboard";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminReadinessPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const admin = createServiceRoleClient();

  // All companies with their latest readiness score
  const { data: companies } = await admin
    .from("companies")
    .select("id, company_name, industry, status, updated_at")
    .order("company_name", { ascending: true });

  // Latest readiness score per company
  const { data: allScores } = await admin
    .from("company_readiness_scores")
    .select(
      "id, company_id, total_score, effective_score, override_score, override_reason, overridden_by, overridden_at, factor_scores, scored_by, document_count, outreach_unlocked, created_at",
    )
    .order("created_at", { ascending: false });

  // Overrider profile names
  const overriderIds = [
    ...new Set(
      (allScores ?? [])
        .map((s) => s.overridden_by)
        .filter(Boolean) as string[],
    ),
  ];
  const { data: overriderProfiles } =
    overriderIds.length > 0
      ? await admin
          .from("profiles")
          .select("id, full_name, email")
          .in("id", overriderIds)
      : { data: [] };

  const overriderMap = Object.fromEntries(
    (overriderProfiles ?? []).map((p) => [p.id, p.full_name ?? p.email ?? "Admin"]),
  );

  type ScoreRow = NonNullable<typeof allScores>[number];

  // Build per-company latest score map
  const latestScoreByCompany = new Map<string, ScoreRow>();
  for (const s of allScores ?? []) {
    if (!latestScoreByCompany.has(s.company_id)) {
      latestScoreByCompany.set(s.company_id, s);
    }
  }

  const rows = (companies ?? []).map((c) => {
    const score = latestScoreByCompany.get(c.id) ?? null;
    return {
      companyId: c.id,
      companyName: c.company_name,
      industry: c.industry,
      status: c.status,
      score: score
        ? {
            id: score.id,
            totalScore: score.total_score,
            effectiveScore: score.effective_score ?? score.total_score,
            overrideScore: score.override_score ?? null,
            overrideReason: score.override_reason ?? null,
            overriddenBy: score.overridden_by ? (overriderMap[score.overridden_by] ?? "Admin") : null,
            overriddenAt: score.overridden_at ?? null,
            factorScores: score.factor_scores as Record<string, unknown>,
            scoredBy: score.scored_by,
            documentCount: score.document_count,
            outreachUnlocked: score.outreach_unlocked,
            scoredAt: score.created_at,
          }
        : null,
    };
  });

  const totalScored = rows.filter((r) => r.score !== null).length;
  const outreachUnlocked = rows.filter((r) => r.score?.outreachUnlocked).length;
  const avgScore =
    totalScored > 0
      ? Math.round(
          rows
            .filter((r) => r.score !== null)
            .reduce((sum, r) => sum + (r.score!.effectiveScore ?? 0), 0) / totalScored,
        )
      : 0;
  const overrideCount = rows.filter((r) => r.score?.overrideScore !== null && r.score?.overrideScore !== undefined).length;

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
      profileEmail={profile.email ?? undefined}
    >
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
          Admin Workspace
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Investable Readiness
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          AI-powered readiness scores across all companies. Scores are visible to
          investors and admins only — founders cannot see their score.
        </p>
      </div>

      <AdminReadinessDashboard
        rows={rows}
        metrics={{ totalScored, outreachUnlocked, avgScore, overrideCount, totalCompanies: rows.length }}
      />
    </AppShell>
  );
}
