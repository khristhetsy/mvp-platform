export function WorkspaceModulePlaceholder({
  title,
  description = "This section is in development and will be available in a future release.",
}: Readonly<{
  title: string;
  description?: string;
}>) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center shadow-[var(--shadow-panel)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gold)]">Coming soon</p>
      <p className="mt-2 text-sm font-semibold text-slate-950">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}
