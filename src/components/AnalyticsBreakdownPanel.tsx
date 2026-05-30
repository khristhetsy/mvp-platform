import { WorkspacePanel } from "@/components/WorkspacePanel";

export function AnalyticsBreakdownPanel({
  title,
  subtitle,
  rows,
}: Readonly<{
  title: string;
  subtitle?: string;
  rows: Array<{ label: string; value: string }>;
}>) {
  return (
    <WorkspacePanel title={title} subtitle={subtitle}>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 text-sm">
            <span className="text-slate-600">{row.label}</span>
            <span className="font-medium text-slate-900">{row.value}</span>
          </div>
        ))}
      </div>
    </WorkspacePanel>
  );
}
