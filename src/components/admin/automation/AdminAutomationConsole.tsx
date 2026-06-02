"use client";

import { Suspense, useState } from "react";
import type { AutomationConsolePayload } from "@/lib/automation/admin-console-types";
import { AutomationDependencyPanel } from "@/components/admin/automation/AutomationDependencyPanel";
import { AutomationExecutionControls } from "@/components/admin/automation/AutomationExecutionControls";
import { AutomationExecutionTimeline } from "@/components/admin/automation/AutomationExecutionTimeline";
import { AutomationFilters } from "@/components/admin/automation/AutomationFilters";
import { AutomationRunDrawer } from "@/components/admin/automation/AutomationRunDrawer";
import { AutomationRunTable } from "@/components/admin/automation/AutomationRunTable";
import { AutomationStatsStrip } from "@/components/admin/automation/AutomationStatsStrip";
import { ViewToolbar } from "@/components/ui/ViewToolbar";
import { PageSection } from "@/components/ui/workspace-layout";
import { useViewMode } from "@/hooks/use-view-mode";

function SafetyStrip({ payload }: Readonly<{ payload: AutomationConsolePayload }>) {
  const { safety, cron, ruleFrequency } = payload;
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 px-4 py-3 text-xs">
        <p className="font-semibold uppercase tracking-wide text-slate-600">Safety visibility</p>
        <ul className="mt-2 space-y-1 text-slate-700">
          <li>Dry runs today: {safety.dryRunsToday}</li>
          <li>Guard skips: {safety.guardSkipsToday}</li>
          <li>Cooldown skips: {safety.cooldownSkipsToday}</li>
          <li>Dedupe keys logged: {safety.dedupePreventionsToday}</li>
          <li>Recursion / chain limits: {safety.recursionPreventionsToday}</li>
        </ul>
      </div>
      <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 px-4 py-3 text-xs">
        <p className="font-semibold uppercase tracking-wide text-slate-600">Cron visibility</p>
        <ul className="mt-2 space-y-1 text-slate-700">
          <li>Scheduled automation runs today: {cron.cronAutomationRunsToday}</li>
          <li>Manual runs today: {cron.manualRunsToday}</li>
          <li>Failed cron orchestration today: {cron.failedCronOrchestrationToday}</li>
        </ul>
      </div>
      <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 px-4 py-3 text-xs">
        <p className="font-semibold uppercase tracking-wide text-slate-600">Top triggering rules</p>
        {ruleFrequency.length ? (
          <ul className="mt-2 space-y-1 font-mono text-slate-700">
            {ruleFrequency.map((r) => (
              <li key={r.ruleId} className="flex justify-between gap-2">
                <span className="truncate">{r.ruleId}</span>
                <span>×{r.count}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-slate-600">No rule frequency data in current filter window.</p>
        )}
      </div>
    </div>
  );
}

function ConsoleBody({
  payload,
  isAdmin,
}: Readonly<{ payload: AutomationConsolePayload; isAdmin: boolean }>) {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const { viewMode, density, setViewMode, setDensity, allowedModes } = useViewMode("admin-automation");

  return (
    <div className="space-y-6">
      <ViewToolbar
        viewMode={viewMode}
        allowedModes={allowedModes}
        onViewModeChange={setViewMode}
        density={density}
        onDensityChange={setDensity}
        showSearch={false}
        showSavedViews={false}
        sticky
      />
      <AutomationStatsStrip stats={payload.stats} cron={payload.cron} />
      <AutomationExecutionControls isAdmin={isAdmin} />
      <Suspense fallback={null}>
        <AutomationFilters />
      </Suspense>
      {viewMode === "analytics" ? (
        <>
          <SafetyStrip payload={payload} />
          <div className="grid gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <PageSection title="Automation runs" subtitle={`Showing up to ${payload.runs.length} runs`}>
                <AutomationRunTable runs={payload.runs} onSelect={setSelectedRunId} />
              </PageSection>
            </div>
            <div className="space-y-4">
              <AutomationDependencyPanel
                topBlockers={payload.topBlockers}
                blockedWorkflows={payload.stats.blockedWorkflows}
              />
              <PageSection title="Automation timeline" subtitle="Recent operational automation events">
                <AutomationExecutionTimeline items={payload.timeline} />
              </PageSection>
            </div>
          </div>
        </>
      ) : viewMode === "table" ? (
        <PageSection title="Automation runs" subtitle={`Showing up to ${payload.runs.length} runs`}>
          <AutomationRunTable runs={payload.runs} onSelect={setSelectedRunId} />
        </PageSection>
      ) : (
        <PageSection title="Automation timeline" subtitle="Recent operational automation events">
          <AutomationExecutionTimeline items={payload.timeline} />
        </PageSection>
      )}
      <AutomationRunDrawer runId={selectedRunId} onClose={() => setSelectedRunId(null)} />
    </div>
  );
}

export function AdminAutomationConsole({
  payload,
  isAdmin,
}: Readonly<{ payload: AutomationConsolePayload; isAdmin: boolean }>) {
  return <ConsoleBody payload={payload} isAdmin={isAdmin} />;
}
