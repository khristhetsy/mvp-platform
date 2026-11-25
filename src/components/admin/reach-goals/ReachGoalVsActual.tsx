import { loadReachActuals } from "@/lib/admin/reach-goal-actuals";
import { getReachGoals } from "@/lib/settings/platform-settings";
import { ReachGoalVsActualView } from "./ReachGoalVsActualView";

/**
 * Reach goal vs actual on the admin AI Agent page. Server component: the page
 * has already checked the staff permission. Render it inside Suspense so the
 * counts never hold up the rest of the page. If the counts cannot be loaded it
 * says so; it never shows zeros in their place.
 */
export async function ReachGoalVsActual() {
  const [goals, actuals] = await Promise.all([
    getReachGoals(),
    loadReachActuals().catch((err: unknown) => {
      console.error("[reach-goals] could not load actuals", err);
      return null;
    }),
  ]);
  if (!actuals) {
    return (
      <section className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4" aria-label="Goal vs actual">
        <h2 className="text-sm font-semibold text-rose-800">Goal vs actual</h2>
        <p className="mt-1 text-sm text-rose-700">Could not load the Introductions and Automated outreach counts. Reload the page to try again.</p>
      </section>
    );
  }
  return <ReachGoalVsActualView actuals={actuals} goals={goals} />;
}

export function ReachGoalVsActualLoading() {
  return (
    <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5" aria-label="Goal vs actual" aria-busy="true">
      <h2 className="text-lg font-semibold text-slate-950">Goal vs actual</h2>
      <p className="mt-1 text-sm text-slate-500">Loading Introductions and Automated outreach counts…</p>
    </section>
  );
}
