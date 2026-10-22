const SECTIONS = [
  { title: "At a glance", widths: ["w-3/4"] },
  { title: "Where they are", widths: ["w-1/2"] },
  { title: "Do next", widths: ["w-2/5"] },
];

/**
 * Shown the instant the Company workspace opens, while its data loads. The
 * company name and industry are real (one small lookup); the sections are
 * placeholders that the full workspace replaces when it is ready.
 */
export function WorkspaceLoadingSkeleton({ name, industry }: Readonly<{ name: string | null; industry: string | null }>) {
  return (
    <div role="status" aria-live="polite" aria-label="Loading company workspace" className="space-y-4">
      <div>
        <div className="text-xs font-semibold uppercase tracking-widest text-blue-600">Company workspace</div>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">{name ?? "Loading company"}</h1>
        {industry ? <p className="mt-1 text-sm text-slate-600">{industry}</p> : null}
        <p className="mt-2 text-xs text-slate-500">Loading the latest numbers…</p>
      </div>
      <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white px-4">
        {SECTIONS.map((section) => (
          <div key={section.title} className="flex items-center gap-3 py-4">
            <div className="h-5 w-5 animate-pulse rounded-full bg-slate-200" aria-hidden="true" />
            <div className="flex-1">
              <div className="text-sm font-medium text-slate-900">{section.title}</div>
              {section.widths.map((w) => (
                <div key={w} className={`mt-2 h-3 animate-pulse rounded bg-slate-200 ${w}`} aria-hidden="true" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
