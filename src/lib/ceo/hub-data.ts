// CEO Hub read model. Assembles the registry + weekly snapshots + latest AI content +
// recommendations + goals + latest brief into one payload. Read-only; UI computes
// period aggregation and comparisons client-side via lib/ceo/kpi.ts.

import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import type { KpiDirection } from "@/lib/ceo/kpi";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return serviceRoleClientUntyped(); }

export interface CeoKpi {
  key: string; dept: "sales" | "marketing" | "operations"; label: string; owner: string;
  fmt: string; direction: KpiDirection; scalesWithPeriod: boolean;
  target: number; redLine: number; weight: number; benchmark: string | null;
  weeks: Array<{ weekStart: string; value: number }>;
  ai: { diagnosis: string; solutions: string[]; mentorship: string; coachPrompt: string; model: string } | null;
}
export interface CeoRecommendation { id: string; title: string; detail: string; hub: string | null; priority: string; status: string }
export interface CeoGoal { id: string; title: string; metric: string | null; target: number | null; current: number; period: string | null; dueDate: string | null }
export interface CeoBrief { headline: string; sections: unknown; model: string | null; briefDate: string }
export interface CeoPayload {
  kpis: CeoKpi[];
  recommendations: CeoRecommendation[];
  goals: CeoGoal[];
  brief: CeoBrief | null;
  generatedAt: string;
}

export async function loadCeoPayload(): Promise<CeoPayload> {
  const [{ data: reg }, { data: snaps }, { data: ai }, { data: recs }, { data: goals }, { data: briefs }] = await Promise.all([
    db().from("ceo_kpi_registry").select("*").eq("active", true).order("dept").order("sort_order"),
    db().from("ceo_kpi_snapshots").select("kpi_key, week_start, value").order("week_start", { ascending: true }),
    db().from("ceo_kpi_ai").select("kpi_key, week_start, diagnosis, solutions, mentorship, coach_prompt, model").order("week_start", { ascending: false }),
    db().from("ceo_recommendations").select("id, title, detail, hub, priority, status").eq("status", "open").order("created_at", { ascending: false }),
    db().from("ceo_goals").select("id, title, metric, target, current, period, due_date").order("sort_order"),
    db().from("ceo_briefs").select("headline, sections, model, brief_date").order("brief_date", { ascending: false }).limit(1),
  ]);

  const byKpi = new Map<string, Array<{ weekStart: string; value: number }>>();
  for (const s of (snaps ?? []) as Array<{ kpi_key: string; week_start: string; value: number }>) {
    const arr = byKpi.get(s.kpi_key) ?? [];
    arr.push({ weekStart: s.week_start, value: Number(s.value) });
    byKpi.set(s.kpi_key, arr);
  }
  const aiByKpi = new Map<string, { diagnosis: string; solutions: string[]; mentorship: string; coachPrompt: string; model: string }>();
  for (const a of (ai ?? []) as Array<{ kpi_key: string; diagnosis: string; solutions: unknown; mentorship: string; coach_prompt: string; model: string }>) {
    if (!aiByKpi.has(a.kpi_key)) aiByKpi.set(a.kpi_key, { diagnosis: a.diagnosis, solutions: Array.isArray(a.solutions) ? (a.solutions as string[]) : [], mentorship: a.mentorship, coachPrompt: a.coach_prompt, model: a.model });
  }

  const kpis: CeoKpi[] = ((reg ?? []) as Array<Record<string, unknown>>).map((r) => ({
    key: String(r.key), dept: r.dept as CeoKpi["dept"], label: String(r.label), owner: String(r.owner),
    fmt: String(r.fmt), direction: r.direction as KpiDirection, scalesWithPeriod: Boolean(r.scales_with_period),
    target: Number(r.target), redLine: Number(r.red_line), weight: Number(r.weight), benchmark: (r.benchmark as string) ?? null,
    weeks: byKpi.get(String(r.key)) ?? [],
    ai: aiByKpi.get(String(r.key)) ?? null,
  }));

  const brief = ((briefs ?? []) as Array<Record<string, unknown>>)[0];

  return {
    kpis,
    recommendations: ((recs ?? []) as Array<Record<string, unknown>>).map((x) => ({ id: String(x.id), title: String(x.title), detail: String(x.detail ?? ""), hub: (x.hub as string) ?? null, priority: String(x.priority), status: String(x.status) })),
    goals: ((goals ?? []) as Array<Record<string, unknown>>).map((g) => ({ id: String(g.id), title: String(g.title), metric: (g.metric as string) ?? null, target: g.target != null ? Number(g.target) : null, current: Number(g.current ?? 0), period: (g.period as string) ?? null, dueDate: (g.due_date as string) ?? null })),
    brief: brief ? { headline: String(brief.headline ?? ""), sections: brief.sections ?? [], model: (brief.model as string) ?? null, briefDate: String(brief.brief_date) } : null,
    generatedAt: new Date().toISOString(),
  };
}
