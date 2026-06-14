import { WorkspacePanel } from "@/components/WorkspacePanel";
import Link from "next/link";

export function FounderInvestorFitSignals({
  signals,
  approvedCount,
  strongCount,
}: Readonly<{
  signals: string[];
  approvedCount?: number;
  strongCount?: number;
}>) {
  if (signals.length === 0 && !approvedCount && !strongCount) {
    return null;
  }

  return (
    <WorkspacePanel
      title="Investor fit signals"
      subtitle="Aggregate marketplace signals — individual investor preferences are not shown"
      action={
        <Link href="/founder/matching" className="text-xs font-semibold text-indigo-600 hover:text-indigo-500">
          View matches
        </Link>
      }
    >
      {(approvedCount !== undefined || strongCount !== undefined) ? (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {approvedCount !== undefined ? (
            <div className="rounded-lg bg-slate-50 px-3 py-2.5 ring-1 ring-slate-100">
              <p className="text-[11px] text-slate-500">Approved matches</p>
              <p className="mt-0.5 font-mono text-2xl font-semibold text-slate-950">{approvedCount}</p>
            </div>
          ) : null}
          {strongCount !== undefined ? (
            <div className="rounded-lg px-3 py-2.5 ring-1 ring-[#EEEDFE]" style={{ background: "#EEEDFE" }}>
              <p className="text-[11px]" style={{ color: "#534AB7" }}>Strong matches</p>
              <p className="mt-0.5 font-mono text-2xl font-semibold" style={{ color: "#3C3489" }}>{strongCount}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      <ul className="space-y-2">
        {signals.map((signal) => (
          <li
            key={signal}
            className="flex items-start gap-2.5 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700"
          >
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#534AB7]" />
            {signal}
          </li>
        ))}
      </ul>
    </WorkspacePanel>
  );
}
