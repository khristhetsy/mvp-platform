"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  clientStoriesCopy as copy,
  rangeLabel,
  type ClientStory,
  type StoriesSummary,
} from "@/content/client-stories";

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <p className="font-site-mono text-xs font-semibold uppercase tracking-[0.16em] text-site-steel">{children}</p>
);

function firstName(s: ClientStory): string {
  return s.name.split(" ")[0];
}

/**
 * Client stories: a totals strip (once enough stories are approved), a founder
 * picker (when more than one story is approved), then the selected founder's
 * spotlight and story. The page filters to approved stories before calling this.
 */
export function ClientStories({ stories, summary }: { stories: ClientStory[]; summary: StoriesSummary | null }) {
  const [active, setActive] = useState(stories[0]?.slug ?? "");

  // Deep link: /clients#dorrin-prophet opens that founder. Read after mount so
  // server and client markup match on first render.
  useEffect(() => {
    const fromHash = () => {
      const slug = window.location.hash.replace("#", "");
      if (stories.some((s) => s.slug === slug)) setActive(slug);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [stories]);

  if (stories.length === 0) return null;
  const multiple = stories.length > 1;

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (i + (e.key === "ArrowRight" ? 1 : stories.length - 1)) % stories.length;
    setActive(stories[next].slug);
    document.getElementById(`tab-${stories[next].slug}`)?.focus();
  };

  return (
    <>
      {summary ? (
        <section className="bg-site-paper px-6 pb-4" aria-label="Across these stories">
          <div className="mx-auto max-w-6xl">
            <dl className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col rounded-2xl border border-site-line bg-white p-5">
                <dt className="order-2 mt-1 text-sm text-site-muted">featured founders rated iCapOS 10 out of 10</dt>
                <dd className="font-site-display text-3xl font-extrabold tracking-tight text-site-navy">{summary.ratedTen} of {summary.total}</dd>
              </div>
              <div className="flex flex-col rounded-2xl border border-site-line bg-white p-5">
                <dt className="order-2 mt-1 text-sm text-site-muted">Capital Readiness scores reached</dt>
                <dd className="font-site-display text-3xl font-extrabold tracking-tight text-site-navy">{rangeLabel(summary.crrMin, summary.crrMax)}</dd>
              </div>
              <div className="flex flex-col rounded-2xl border border-site-line bg-white p-5">
                <dt className="order-2 mt-1 text-sm text-site-muted">to reach those scores</dt>
                <dd className="font-site-display text-3xl font-extrabold tracking-tight text-site-navy">
                  {rangeLabel(summary.weeksMin, summary.weeksMax)} {summary.weeksMax === 1 ? "week" : "weeks"}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-[12px] leading-5 text-site-muted">
              Based on interviews with {summary.total} founders. Individual experiences, not a representative sample of all users. Results vary.
            </p>
          </div>
        </section>
      ) : null}

      {multiple ? (
        <section className="bg-site-paper px-6 pb-2 pt-6">
          <div role="tablist" aria-label="Founder stories" className="mx-auto grid max-w-6xl gap-4 md:grid-cols-3">
            {stories.map((s, i) => {
              const on = s.slug === active;
              return (
                <button
                  key={s.slug}
                  id={`tab-${s.slug}`}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  aria-controls={`panel-${s.slug}`}
                  tabIndex={on ? 0 : -1}
                  onClick={() => setActive(s.slug)}
                  onKeyDown={(e) => onKeyDown(e, i)}
                  className={`flex items-center gap-4 rounded-2xl border-2 bg-white p-4 text-left transition-colors ${on ? "border-site-blue shadow-[0_8px_24px_rgba(26,108,228,0.14)]" : "border-site-line hover:border-site-blue-lt"}`}
                >
                  <Image src={s.photoUrl} alt="" width={46} height={46} className="h-[46px] w-[46px] shrink-0 rounded-full object-cover object-top" />
                  <span>
                    <span className="block font-site-display text-[15px] font-bold leading-tight text-site-navy">{s.name}</span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-site-muted">{s.title}, {s.company}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {stories.map((s) => (
        <div
          key={s.slug}
          id={`panel-${s.slug}`}
          role={multiple ? "tabpanel" : undefined}
          aria-labelledby={multiple ? `tab-${s.slug}` : undefined}
          hidden={multiple && s.slug !== active}
        >
          <Spotlight s={s} />
          <Story s={s} />
        </div>
      ))}
    </>
  );
}

function Spotlight({ s }: { s: ClientStory }) {
  return (
    <section className="bg-site-paper px-6 pb-4 pt-6" aria-labelledby={`spotlight-${s.slug}`}>
      <div className="mx-auto max-w-6xl rounded-3xl bg-site-navy p-8 text-white sm:p-12">
        <div className="flex flex-col gap-10 lg:flex-row lg:gap-14">
          <div className="flex shrink-0 flex-col items-start gap-5 lg:w-64">
            <div className="relative aspect-[4/5] w-full max-w-[260px] overflow-hidden rounded-2xl bg-site-navy-3 lg:max-w-none">
              <Image src={s.photoUrl} alt={s.name} fill sizes="(min-width: 1024px) 256px, 260px" className="object-cover object-top" />
            </div>
            <div>
              <p className="font-site-display text-lg font-bold leading-tight">{s.name}</p>
              <p className="mt-0.5 text-sm text-white/70">{s.title}, {s.company}</p>
            </div>
            {s.logoUrl ? (
              <div className="w-full max-w-[260px] rounded-2xl bg-white p-4 lg:max-w-none">
                <Image src={s.logoUrl} alt={`${s.company} logo`} width={900} height={375} className="h-auto w-full" />
              </div>
            ) : null}
          </div>

          <div className="min-w-0 flex-1">
            <span className="inline-flex rounded-md bg-site-blue px-3 py-1.5 font-site-mono text-xs font-semibold uppercase tracking-[0.12em] text-white">{copy.spotlightLabel}</span>
            <h2 id={`spotlight-${s.slug}`} className="sr-only">{copy.spotlightLabel}: {s.name}</h2>
            <blockquote className="mt-6 font-site-display text-2xl font-bold leading-snug tracking-tight sm:text-4xl">
              &ldquo;{s.headline}&rdquo;
            </blockquote>
            <p className="mt-6 max-w-2xl text-base leading-7 text-white/80">{s.summary}</p>

            <dl className="mt-8 grid gap-4 sm:grid-cols-3">
              {s.stats.map((x) => (
                <div key={x.value} className="rounded-xl bg-site-navy-3 p-5">
                  <dt className="font-site-display text-3xl font-extrabold leading-none">{x.value}</dt>
                  <dd className="mt-3 text-sm leading-5 text-white/80">{x.label}</dd>
                </div>
              ))}
            </dl>

            <a href={`#story-${s.slug}`} className="mt-8 inline-flex rounded-lg bg-white px-5 py-3 text-sm font-semibold text-site-navy transition-colors hover:bg-site-blue-pale">Read {firstName(s)}&rsquo;s story</a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Story({ s }: { s: ClientStory }) {
  return (
    <>
      <section id={`story-${s.slug}`} className="bg-white px-6 pb-8 pt-20" aria-labelledby={`story-heading-${s.slug}`}>
        <div className="mx-auto max-w-6xl">
          <Eyebrow>{firstName(s)}&rsquo;s story</Eyebrow>
          <h2 id={`story-heading-${s.slug}`} className="mt-3 max-w-3xl font-site-display text-3xl font-extrabold tracking-tight text-site-navy sm:text-4xl">{s.storyTitle}</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {s.story.map((c) => (
              <article key={c.eyebrow} className="rounded-2xl border border-site-line bg-white p-7">
                <Eyebrow>{c.eyebrow}</Eyebrow>
                <h3 className="mt-3 font-site-display text-xl font-bold text-site-navy">{c.title}</h3>
                {c.body.map((p) => (
                  <p key={p} className="mt-3 text-[15px] leading-7 text-site-muted">{p}</p>
                ))}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-6 pb-6 pt-6">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2">
          {s.pullQuotes.map((q) => (
            <figure key={q.text} className="rounded-2xl bg-site-blue-pale p-8 sm:p-10">
              <blockquote className="font-site-display text-xl font-bold leading-snug text-site-navy sm:text-2xl">&ldquo;{q.text}&rdquo;</blockquote>
              <figcaption className="mt-5 text-sm font-semibold text-site-steel">{q.attribution}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="bg-white px-6 pb-20 pt-2">
        <div className="mx-auto max-w-6xl">
          <div className="overflow-hidden rounded-2xl border border-site-line bg-white">
            <table className="w-full text-left text-[15px]">
              <caption className="sr-only">{copy.snapshotHeading}: {s.name}</caption>
              <thead className="hidden bg-site-paper md:table-header-group">
                <tr className="font-site-mono text-[11.5px] uppercase tracking-[0.12em] text-site-blue-hi">
                  <th scope="col" className="w-56 px-6 py-3 font-semibold">{copy.snapshotHeading}</th>
                  <th scope="col" className="px-6 py-3 font-semibold">Before iCapOS</th>
                  <th scope="col" className="px-6 py-3 font-semibold">With iCapOS</th>
                </tr>
              </thead>
              <tbody>
                {s.snapshot.map((r) => (
                  <tr key={r.label} className="block border-t border-site-line first:border-t-0 md:table-row md:border-t md:first:border-t-0">
                    <th scope="row" className="block px-6 pb-1 pt-4 font-semibold text-site-navy md:table-cell md:py-4">{r.label}</th>
                    <td className="block px-6 py-1 text-site-muted md:table-cell md:py-4">
                      <span className="mr-2 font-site-mono text-[11px] uppercase tracking-wider text-site-steel md:hidden">Before</span>{r.before}
                    </td>
                    <td className="block px-6 pb-4 pt-1 text-site-ink md:table-cell md:py-4">
                      <span className="mr-2 font-site-mono text-[11px] uppercase tracking-wider text-site-steel md:hidden">With iCapOS</span>{r.after}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {s.note ? (
            <aside className="mt-6 rounded-2xl border border-site-line border-l-4 border-l-site-blue bg-white p-6">
              <h3 className="font-site-display text-lg font-bold text-site-navy">{s.note.title}</h3>
              <p className="mt-2 max-w-4xl text-[15px] leading-7 text-site-muted">{s.note.body}</p>
            </aside>
          ) : null}

          <p className="mt-5 text-[12px] leading-5 text-site-muted">{copy.quoteNote}</p>
        </div>
      </section>
    </>
  );
}
