import Link from "next/link";
import {
  crrBadge,
  founderResults,
  founderResultsCopy as copy,
  initials,
  visibleFounderResults,
  type FounderResult,
} from "@/content/founder-results";

/**
 * iCapOS founder results (testimonials with CRR progress). Renders nothing until
 * enough approved entries exist in src/content/founder-results.ts, so the site
 * never shows placeholder or invented quotes.
 */
export function FounderResults({ results = founderResults }: { results?: FounderResult[] }) {
  const items = visibleFounderResults(results);
  if (items.length === 0) return null;

  return (
    <section className="bg-site-paper px-6 py-20" aria-labelledby="founder-results-heading">
      <div className="mx-auto max-w-6xl">
        <p className="text-center font-site-mono text-xs font-semibold uppercase tracking-[0.16em] text-site-blue">{copy.eyebrow}</p>
        <h2 id="founder-results-heading" className="mt-3 text-center font-site-display text-3xl font-extrabold tracking-tight text-site-navy sm:text-4xl">{copy.title}</h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-lg leading-8 text-site-muted">{copy.intro}</p>

        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map((r, i) => {
            const badge = crrBadge(r);
            const meta = r.anonymous
              ? "Anonymous at founder's request"
              : [r.industry, r.stage, r.timeOnPlatform].filter(Boolean).join(" · ");
            const role = r.anonymous
              ? [r.stage, r.industry, "company"].filter(Boolean).join(" ")
              : [r.title, r.company].filter(Boolean).join(", ");
            return (
              <figure key={`${r.name ?? "anon"}-${i}`} className="flex flex-col gap-4 rounded-2xl border border-site-line bg-white p-6">
                {badge ? (
                  <span className="inline-flex items-center gap-2 self-start rounded-lg bg-site-blue-pale px-3 py-1.5 text-[13px] font-semibold text-site-navy">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 stroke-site-blue" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" /></svg>
                    {badge}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 self-start rounded-lg bg-site-paper px-3 py-1.5 text-[13px] font-semibold text-site-muted">Score not shared</span>
                )}
                <blockquote className="flex-1 text-[15px] leading-7 text-site-ink">“{r.quote}”</blockquote>
                <figcaption className="flex items-center gap-3 border-t border-site-line pt-4">
                  {!r.anonymous && r.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.photoUrl} alt={r.name ?? ""} className="h-10 w-10 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-site-navy font-site-mono text-xs font-semibold text-white">
                      {r.anonymous ? "F" : initials(r.name)}
                    </span>
                  )}
                  <span className="text-[13px]">
                    <span className="font-medium text-site-navy">{r.anonymous ? "Founder" : r.name}</span>
                    {role ? (<><br /><span className="text-site-muted">{role}</span></>) : null}
                  </span>
                </figcaption>
                {meta ? <p className="text-[11px] text-site-muted/80">{meta}</p> : null}
              </figure>
            );
          })}
        </div>

        <div className="mt-10 flex justify-center">
          <Link href={copy.cta.href} className="rounded-lg bg-site-blue px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi">{copy.cta.label}</Link>
        </div>
        <p className="mx-auto mt-4 max-w-3xl text-center text-[12px] leading-5 text-site-muted/80">{copy.disclaimer}</p>
      </div>
    </section>
  );
}
