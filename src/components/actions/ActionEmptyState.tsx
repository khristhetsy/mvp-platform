export function ActionEmptyState({ message }: Readonly<{ message?: string }>) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-12 text-center">
      <p className="text-sm font-medium text-[var(--navy)]">No actions match your filters</p>
      <p className="mt-2 text-xs text-slate-500">
        {message ?? "Try another tab or clear filters to see more workflow items."}
      </p>
    </div>
  );
}
