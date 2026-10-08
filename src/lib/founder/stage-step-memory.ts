/**
 * Stage guide completion memory (founder_stage_step_progress).
 *
 * Two jobs:
 *  - Steps with no measurable signal (doneOnVisit in stage-guides.ts) count as
 *    done once the founder has opened them from the guide.
 *  - Every step gets a completed_at stamp the first time it is seen done, so the
 *    collapsed card can say when. A step that later regresses keeps its stamp
 *    but shows as not done, because done-ness always comes from the live signal.
 *
 * Best effort throughout: if the table is unreachable the guide still renders
 * from the live signals alone, just without dates.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { StageGuide } from "@/lib/founder/stage-guides";
import type { StageProgress, StepProgress } from "@/lib/founder/stage-progress";

type MemoryRow = { step_href: string; first_visited_at: string | null; completed_at: string | null };

function db(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

/** Record that the founder opened a guide step. First visit wins. */
export async function recordStepVisit(companyId: string, stepHref: string): Promise<void> {
  try {
    const now = new Date().toISOString();
    const client = db();
    const { data } = await client
      .from("founder_stage_step_progress")
      .select("first_visited_at")
      .eq("company_id", companyId)
      .eq("step_href", stepHref)
      .maybeSingle();
    if ((data as { first_visited_at?: string | null } | null)?.first_visited_at) return;
    await client
      .from("founder_stage_step_progress")
      .upsert({ company_id: companyId, step_href: stepHref, first_visited_at: now, updated_at: now }, { onConflict: "company_id,step_href" });
  } catch {
    /* best effort */
  }
}

/** True when this href belongs to some stage guide step (guards the visit API). */
export function isGuideStepHref(guides: StageGuide[], href: string): boolean {
  return guides.some((g) => g.steps.some((s) => s.href === href));
}

/**
 * Fold the memory into live progress: visited doneOnVisit steps become done,
 * newly done steps get a completed_at stamp, and every step carries its date.
 */
export async function applyStepMemory(companyId: string, guide: StageGuide, progress: StageProgress): Promise<StageProgress> {
  const steps: Record<string, StepProgress> = { ...progress.steps };
  let rows: MemoryRow[] = [];
  try {
    const { data } = await db()
      .from("founder_stage_step_progress")
      .select("step_href, first_visited_at, completed_at")
      .eq("company_id", companyId)
      .in("step_href", guide.steps.map((s) => s.href));
    rows = (data ?? []) as MemoryRow[];
  } catch {
    rows = [];
  }
  const byHref = new Map(rows.map((r) => [r.step_href, r]));

  const now = new Date().toISOString();
  const stamps: { company_id: string; step_href: string; completed_at: string; updated_at: string; first_visited_at: string | null }[] = [];

  for (const s of guide.steps) {
    const mem = byHref.get(s.href);
    let sp = steps[s.href];
    const measured = sp && sp.percent !== null;
    if (!measured && s.doneOnVisit) {
      sp = mem?.first_visited_at ? { percent: 100, state: "done" } : { percent: null, state: "unknown" };
      steps[s.href] = sp;
    }
    if (sp?.state === "done") {
      const completedAt = mem?.completed_at ?? now;
      if (!mem?.completed_at) {
        stamps.push({ company_id: companyId, step_href: s.href, completed_at: now, updated_at: now, first_visited_at: mem?.first_visited_at ?? null });
      }
      steps[s.href] = { ...sp, completedAt };
    }
  }

  if (stamps.length) {
    try {
      await db().from("founder_stage_step_progress").upsert(stamps, { onConflict: "company_id,step_href" });
    } catch {
      /* best effort */
    }
  }

  const measured = Object.values(steps).map((s) => s.percent).filter((p): p is number => p != null);
  const overall = measured.length ? Math.round(measured.reduce((a, b) => a + b, 0) / measured.length) : null;
  return { steps, overall };
}
