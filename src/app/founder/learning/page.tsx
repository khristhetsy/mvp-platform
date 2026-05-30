import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { FounderLearningMilestones } from "@/components/FounderLearningMilestones";
import { FounderLearningModuleCard } from "@/components/FounderLearningModuleCard";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { loadFounderLearningWorkspace } from "@/lib/learning/load-founder-learning";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function FounderLearningPage() {
  const profile = await requireRole(["founder"]);
  const learning = await loadFounderLearningWorkspace(profile);
  const companyName = learning.company?.company_name ?? "Your company";

  const recommendedBySlug = new Map(
    learning.recommendations.map((item) => [item.slug, item.reason]),
  );

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={companyName}
    >
      <FounderFeatureGate featureKey="elearning">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">Founder Workspace</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Institutional readiness learning</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Venture-readiness progression tied to your remediation gaps, onboarding, documents, and diligence — not a
            generic course marketplace.
          </p>
          <p className="mt-3 text-sm font-medium text-slate-700">
            Overall curriculum progress: <span className="text-indigo-700">{learning.overallPercent}%</span>
          </p>
        </div>

        <section className="mb-8 grid gap-6 xl:grid-cols-2">
          <WorkspacePanel title="Recommended for you" subtitle="Adaptive modules from your current gaps">
            {learning.recommendedModules.length === 0 ? (
              <p className="text-sm text-slate-600">
                Complete onboarding and remediation tasks to unlock tailored recommendations.
              </p>
            ) : (
              <div className="grid gap-3">
                {learning.recommendedModules.slice(0, 4).map((module) => (
                  <FounderLearningModuleCard
                    key={module.id}
                    module={module}
                    highlight={recommendedBySlug.get(module.slug)}
                  />
                ))}
              </div>
            )}
          </WorkspacePanel>

          <WorkspacePanel title="Continue learning" subtitle="Resume in-progress modules">
            {learning.continueModules.length === 0 ? (
              <p className="text-sm text-slate-600">No modules in progress. Start a recommended module above.</p>
            ) : (
              <div className="grid gap-3">
                {learning.continueModules.slice(0, 3).map((module) => (
                  <FounderLearningModuleCard key={module.id} module={module} />
                ))}
              </div>
            )}
          </WorkspacePanel>
        </section>

        <section className="mb-8">
          <WorkspacePanel
            title="Readiness milestones"
            subtitle="Derived from onboarding, remediation, documents, diligence, and learning progress"
          >
            <FounderLearningMilestones
              milestones={learning.milestones}
              currentLabel={learning.currentMilestone?.label ?? null}
              nextLabel={
                learning.nextMilestone
                  ? `Next: ${learning.nextMilestone.label} — ${learning.nextMilestone.criteriaPending[0] ?? "complete pending criteria"}`
                  : null
              }
            />
          </WorkspacePanel>
        </section>

        <section>
          <WorkspacePanel title="All learning modules" subtitle="Institutional-readiness curriculum by stage">
            <div className="grid gap-4 md:grid-cols-2">
              {learning.modules.map((module) => (
                <FounderLearningModuleCard key={module.id} module={module} />
              ))}
            </div>
          </WorkspacePanel>
        </section>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
