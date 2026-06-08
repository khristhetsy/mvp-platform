import { MetricSkeletonRow } from "@/components/ui/Skeleton";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";

function LoadingSpinner({ label }: Readonly<{ label: string }>) {
  return (
    <div className="flex items-center gap-2 text-xs font-medium text-slate-500" role="status" aria-live="polite">
      <span
        className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600"
        aria-hidden
      />
      <span>{label}</span>
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)]">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="enterprise-skeleton h-4 w-40" />
        <div className="enterprise-skeleton mt-2 h-3 w-56" />
      </div>
      <div className="space-y-3 px-5 py-5">
        <div className="enterprise-skeleton h-3 w-full" />
        <div className="enterprise-skeleton h-3 w-11/12" />
        <div className="enterprise-skeleton h-3 w-4/5" />
        <div className="enterprise-skeleton mt-4 h-24 w-full rounded-lg" />
      </div>
    </div>
  );
}

function PageHeaderSkeleton() {
  return (
    <header className="mb-6 border-b border-slate-200/90 pb-6">
      <div className="enterprise-skeleton h-3 w-32" />
      <div className="enterprise-skeleton mt-3 h-8 w-64 max-w-full" />
      <div className="enterprise-skeleton mt-3 h-4 w-full max-w-2xl" />
      <div className="enterprise-skeleton mt-2 h-4 w-3/4 max-w-xl" />
    </header>
  );
}

export function WorkspaceRouteLoading({
  workspaceLabel,
}: Readonly<{
  workspaceLabel: string;
}>) {
  return (
    <WorkspacePageContainer aria-busy="true" aria-label={`Loading ${workspaceLabel}`}>
      <div className="mb-4 flex justify-end">
        <LoadingSpinner label="Loading page…" />
      </div>
      <PageHeaderSkeleton />
      <MetricSkeletonRow />
      <div className="grid gap-5 md:grid-cols-2">
        <PanelSkeleton />
        <PanelSkeleton />
      </div>
      <PanelSkeleton />
    </WorkspacePageContainer>
  );
}

export function MarketingRouteLoading({
  sectionLabel,
}: Readonly<{
  sectionLabel: string;
}>) {
  return (
    <section className="px-4 py-8 lg:px-8 lg:py-10" aria-busy="true" aria-label={`Loading ${sectionLabel}`}>
      <div className="mb-6 flex justify-end">
        <LoadingSpinner label="Loading…" />
      </div>
      <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-[var(--shadow-panel)] lg:p-7">
        <div className="enterprise-skeleton h-3 w-36" />
        <div className="enterprise-skeleton mt-4 h-9 w-full max-w-2xl" />
        <div className="enterprise-skeleton mt-4 h-4 w-full max-w-3xl" />
        <div className="enterprise-skeleton mt-2 h-4 w-5/6 max-w-2xl" />
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[var(--shadow-panel)]"
          >
            <div className="enterprise-skeleton h-4 w-3/4" />
            <div className="enterprise-skeleton mt-3 h-3 w-full" />
            <div className="enterprise-skeleton mt-2 h-3 w-2/3" />
            <div className="enterprise-skeleton mt-5 h-9 w-28 rounded-full" />
          </div>
        ))}
      </div>
    </section>
  );
}
