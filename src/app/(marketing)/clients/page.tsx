import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { clientSpotlight as s, clientStoriesCopy as copy, spotlightApproved } from "@/content/client-stories";
import { FounderResultsSection } from "@/components/marketing-site/FounderResultsSection";

export const metadata: Metadata = {
  title: copy.metaTitle,
  description: copy.metaDescription,
  alternates: { canonical: "/clients" },
};

const Eyebrow = ({ children, onDark = false }: { children: React.ReactNode; onDark?: boolean }) => (
  <p className={`font-site-mono text-xs font-semibold uppercase tracking-[0.16em] ${onDark ? "text-site-blue-lt" : "text-site-steel"}`}>{children}</p>
);

export default function ClientsPage() {
  const show = spotlightApproved();
  return (
    <>
      {/* Hero */}
      <section className="bg-site-paper px-6 pb-14 pt-20">
        <div className="mx-auto max-w-6xl">
          <Eyebrow>{copy.hero.eyebrow}</Eyebrow>
          <h1 className="mt-4 max-w-3xl font-site-display text-4xl font-extrabold leading-[1.06] tracking-tight text-site-navy sm:text-5xl lg:text-6xl">{copy.hero.title}</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-site-muted">{copy.hero.sub}</p>
        </div>
      </section>

      {show ? (
        <>
          {/* Spotlight */}
          <section className="bg-site-paper px-6 pb-4" aria-labelledby="spotlight-heading">
            <div className="mx-auto max-w-6xl rounded-3xl bg-site-navy p-8 text-white sm:p-12">
              <div className="flex flex-col gap-10 lg:flex-row lg:gap-14">
                <div className="flex shrink-0 flex-col items-start gap-5 lg:w-64">
                  <div className="w-full rounded-2xl bg-white p-5">
                    <Image src={s.logoUrl} alt={`${s.company} logo`} width={900} height={375} className="h-auto w-full" />
                  </div>
                  <div className="flex items-center gap-3">
                    <Image src={s.photoUrl} alt={s.name} width={40} height={40} className="h-10 w-10 shrink-0 rounded-full object-cover" />
                    <div>
                      <p className="font-site-display text-lg font-bold leading-tight">{s.name}</p>
                      <p className="mt-0.5 text-sm text-white/70">{s.title}, {s.company}</p>
                    </div>
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <span className="inline-flex rounded-md bg-site-blue px-3 py-1.5 font-site-mono text-xs font-semibold uppercase tracking-[0.12em] text-white">{copy.spotlightLabel}</span>
                  <h2 id="spotlight-heading" className="sr-only">{copy.spotlightLabel}: {s.name}</h2>
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

                  <a href="#story" className="mt-8 inline-flex rounded-lg bg-white px-5 py-3 text-sm font-semibold text-site-navy transition-colors hover:bg-site-blue-pale">Read {s.name.split(" ")[0]}&rsquo;s story</a>
                </div>
              </div>
            </div>
          </section>

          {/* Story */}
          <section id="story" className="bg-white px-6 pb-8 pt-20" aria-labelledby="story-heading">
            <div className="mx-auto max-w-6xl">
              <Eyebrow>{copy.storyEyebrow}</Eyebrow>
              <h2 id="story-heading" className="mt-3 max-w-3xl font-site-display text-3xl font-extrabold tracking-tight text-site-navy sm:text-4xl">{copy.storyTitle}</h2>
              <div className="mt-10 grid gap-6 md:grid-cols-3">
                {s.story.map((c) => (
                  <article key={c.eyebrow} className="rounded-2xl border border-site-line bg-white p-7">
                    <Eyebrow>{c.eyebrow}</Eyebrow>
                    <h3 className="mt-3 font-site-display text-xl font-bold text-site-navy">{c.title}</h3>
                    <p className="mt-3 text-[15px] leading-7 text-site-muted">{c.body}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          {/* Pull quotes */}
          <section className="bg-white px-6 pb-20 pt-6">
            <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2">
              {s.pullQuotes.map((q) => (
                <figure key={q} className="rounded-2xl bg-site-blue-pale p-8 sm:p-10">
                  <blockquote className="font-site-display text-xl font-bold leading-snug text-site-navy sm:text-2xl">&ldquo;{q}&rdquo;</blockquote>
                  <figcaption className="mt-5 text-sm font-semibold text-site-steel">{s.name}, {s.company}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        </>
      ) : null}

      {/* More founder results: renders only once enough approved entries exist */}
      <FounderResultsSection />

      {/* CTA */}
      <section className="bg-site-blue px-6 py-20 text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <div className="max-w-xl">
            <h2 className="font-site-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">{copy.cta.title}</h2>
            <p className="mt-4 text-lg leading-8 text-white">{copy.cta.sub}</p>
          </div>
          <Link href={copy.cta.href} className="rounded-lg bg-white px-7 py-4 text-base font-semibold text-site-navy transition-colors hover:bg-site-blue-pale">{copy.cta.label}</Link>
        </div>
      </section>

      <section className="bg-site-navy px-6 py-10">
        <p className="mx-auto max-w-6xl text-[12px] leading-5 text-white/70">{copy.disclaimer}</p>
      </section>
    </>
  );
}
