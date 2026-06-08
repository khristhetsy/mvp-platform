import { WorkflowProgressRail, type WorkflowStep } from "@/components/ui/WorkflowProgressRail";

export function InvestorPipelineStages({
  watchlistCount,
  interestCount,
  introCount,
  spvCount = 0,
}: Readonly<{
  watchlistCount: number;
  interestCount: number;
  introCount: number;
  spvCount?: number;
}>) {
  const steps: WorkflowStep[] = [
    {
      key: "discover",
      label: "Discover",
      complete: watchlistCount > 0 || interestCount > 0,
      current: watchlistCount === 0 && interestCount === 0,
    },
    {
      key: "watchlist",
      label: "Watchlist",
      complete: watchlistCount > 0,
      current: watchlistCount > 0 && interestCount === 0,
      detail: watchlistCount > 0 ? `${watchlistCount} saved` : undefined,
    },
    {
      key: "interest",
      label: "Interest",
      complete: interestCount > 0,
      current: interestCount > 0 && introCount === 0,
      detail: interestCount > 0 ? `${interestCount} expressed` : undefined,
    },
    {
      key: "intro",
      label: "Intro",
      complete: introCount > 0,
      current: introCount > 0,
      detail: introCount > 0 ? `${introCount} requests` : undefined,
    },
    {
      key: "spv",
      label: "SPV",
      complete: spvCount > 0,
      detail: spvCount > 0 ? `${spvCount} participations` : undefined,
    },
  ];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4" aria-labelledby="investor-pipeline-stages-heading">
      <p id="investor-pipeline-stages-heading" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        Engagement pipeline
      </p>
      <div className="mt-3">
        <WorkflowProgressRail steps={steps} compact />
      </div>
    </div>
  );
}
