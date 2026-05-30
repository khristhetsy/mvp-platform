import { WorkspacePanel } from "@/components/WorkspacePanel";

export function FounderInvestorFitSignals({
  signals,
}: Readonly<{
  signals: string[];
}>) {
  if (signals.length === 0) {
    return null;
  }

  return (
    <WorkspacePanel
      title="Investor fit signals"
      subtitle="Aggregate marketplace signals — individual investor preferences are not shown"
    >
      <ul className="space-y-2 text-sm leading-6 text-slate-700">
        {signals.map((signal) => (
          <li key={signal} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
            {signal}
          </li>
        ))}
      </ul>
    </WorkspacePanel>
  );
}
