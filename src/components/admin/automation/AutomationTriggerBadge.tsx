export function AutomationTriggerBadge({ trigger }: Readonly<{ trigger: string | null }>) {
  if (!trigger) return <span className="text-xs text-slate-500">—</span>;
  return (
    <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-700">
      {trigger}
    </span>
  );
}
