import Link from "next/link";

export function WorkspaceModulePlaceholder({
  title,
  description,
  futureItems,
  relatedHref,
  relatedLabel,
}: Readonly<{
  title: string;
  description: string;
  futureItems: string[];
  relatedHref?: string;
  relatedLabel?: string;
}>) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">iCapOS workspace</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{title}</h1>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">{description}</p>
      <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6">
        <h2 className="text-sm font-semibold text-slate-950">Planned capabilities</h2>
        <ul className="mt-4 grid gap-2 text-sm text-slate-700">
          {futureItems.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="text-slate-400">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
      {relatedHref && relatedLabel ? (
        <Link
          href={relatedHref}
          className="mt-6 inline-flex rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800 hover:border-slate-950"
        >
          {relatedLabel}
        </Link>
      ) : null}
    </section>
  );
}
