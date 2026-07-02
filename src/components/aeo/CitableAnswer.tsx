// The distinct, liftable answer block — rendered high on the page so AI crawlers
// find a self-contained answer first. Server component (no client JS).

export function CitableAnswer({ term, answer }: { term?: string; answer: string }) {
  return (
    <div
      data-aeo="citable-answer"
      className="rounded-2xl border border-slate-200 bg-slate-50 p-6 md:p-7"
    >
      {term ? (
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{term}</p>
      ) : null}
      <p className="text-lg leading-relaxed text-slate-900 md:text-xl">{answer}</p>
    </div>
  );
}
