import type { Metadata } from "next";
import Link from "next/link";
import { home } from "@/content/home";
import { JsonLd } from "@/components/seo/JsonLd";
import { ORGANIZATION_JSONLD } from "@/lib/seo/structured-data";
import { AiModeLauncher } from "@/components/marketing-site/AiModeLauncher";
import { LogoStrip } from "@/components/marketing-site/LogoStrip";
import { Reveal } from "@/components/marketing-site/Reveal";
import { EventGallery } from "@/components/marketing-site/EventGallery";
import { NetworkSupply } from "@/components/marketing-site/NetworkSupply";
import { loadFunnelDelta } from "@/lib/marketing-site/funnel-delta";

// ISR: statically rendered, refreshed hourly so newly-seeded client logos appear.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: { absolute: "iCapOS — Get your company in front of investors whose mandate fits" },
  description:
    "iCapOS does the heavy lifting on investor outreach: it rates your readiness, matches your profile to investor mandates in the iCFO network, and distributes your materials to the ones that fit. Start free.",
  alternates: { canonical: "/" },
  openGraph: { url: "/" },
};

const Eyebrow = ({ children, onDark = false }: { children: React.ReactNode; onDark?: boolean }) => (
  <p className={`font-site-mono text-xs font-semibold uppercase tracking-[0.16em] ${onDark ? "text-site-blue-lt" : "text-site-blue"}`}>{children}</p>
);

export default function MarketingHomePage() {
  const h = home;
  const delta = loadFunnelDelta();
  return (
    <>
      <JsonLd data={ORGANIZATION_JSONLD} />

      {/* Hero */}
      <section className="bg-gradient-to-b from-site-navy via-site-navy-2 to-site-navy-3 px-6 pb-20 pt-20 text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <div>
            <Eyebrow onDark>{h.hero.eyebrow}</Eyebrow>
            <h1 className="mt-4 font-site-display text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">{h.hero.title}</h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/75">{h.hero.sub}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={h.hero.primaryCta.href} className="rounded-lg bg-site-blue px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi">{h.hero.primaryCta.label}</Link>
              <Link href={h.hero.secondaryCta.href} className="rounded-lg border border-white/20 px-5 py-3 text-sm font-semibold text-white transition-colors hover:border-site-blue-lt hover:text-site-blue-lt">{h.hero.secondaryCta.label}</Link>
              <AiModeLauncher />
            </div>
            <p className="mt-8 max-w-xl font-site-mono text-[11px] leading-5 text-white/45">{h.hero.compliance}</p>
          </div>

          {/* Illustrative matched-investors card (sample data — §13) */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-center justify-between">
              <span className="font-site-mono text-xs uppercase tracking-wider text-white/60">{h.hero.card.label}</span>
              <span className="rounded-full bg-site-amber/15 px-2.5 py-0.5 font-site-mono text-[10px] font-medium text-site-amber">{h.hero.card.badge}</span>
            </div>
            <ul className="mt-4 space-y-2">
              {h.hero.card.rows.map((r) => (
                <li key={r.initials} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-site-blue/20 font-site-mono text-xs font-semibold text-site-blue-lt">{r.initials}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-white">{r.name}</div>
                    <div className="truncate text-[11px] text-white/55">{r.detail}</div>
                  </div>
                  <span className="font-site-mono text-xs font-semibold text-site-blue-lt">{r.fit}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center justify-between font-site-mono text-[10px] text-white/40">
              <span>{h.hero.card.footnoteA}</span>
              <span>{h.hero.card.footnoteB}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Network supply — verifiable aggregate figures, above the illustrative cards (brief Step 1) */}
      <NetworkSupply />

      {/* Client logo strip — data-driven from marketing_site_logos (§6, §16) */}
      <LogoStrip heading={h.logos.heading} caption={h.logos.caption} />

      {/* How it works */}
      <section className="bg-site-paper px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <Eyebrow>{h.howItWorks.eyebrow}</Eyebrow>
          <h2 className="mt-3 font-site-display text-3xl font-extrabold tracking-tight text-site-navy sm:text-4xl">{h.howItWorks.title}</h2>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-site-muted">{h.howItWorks.sub}</p>
          <Reveal className="mt-10 grid gap-6 md:grid-cols-3">
            {h.howItWorks.steps.map((s) => (
              <div key={s.n} className="rounded-2xl border border-site-line bg-white p-6">
                <div className="font-site-mono text-2xl font-semibold text-site-blue">{s.n}</div>
                <h3 className="mt-3 font-site-display text-lg font-bold text-site-navy">{s.h}</h3>
                <p className="mt-2 text-sm leading-6 text-site-muted">{s.p}</p>
              </div>
            ))}
          </Reveal>
          <p className="mt-8 rounded-xl border border-site-line bg-white px-5 py-4 text-[13px] leading-6 text-site-muted"><span className="font-medium text-site-navy">{h.howItWorks.outreachNote.split(".")[0]}.</span>{h.howItWorks.outreachNote.slice(h.howItWorks.outreachNote.indexOf(".") + 1)}</p>
        </div>
      </section>

      {/* Funnel argument */}
      <section className="bg-site-navy px-6 py-20 text-white">
        <div className="mx-auto max-w-6xl">
          <Eyebrow onDark>{h.funnel.eyebrow}</Eyebrow>
          <h2 className="mt-3 font-site-display text-3xl font-extrabold tracking-tight sm:text-4xl">{h.funnel.title}</h2>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-white/70">{h.funnel.sub}</p>
          <Reveal className="mt-10 space-y-3">
            {h.funnel.stages.map((s) => (
              <div key={s.h} className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4">
                <div><div className="text-sm font-medium text-white">{s.h}</div><div className="text-[12px] text-white/55">{s.p}</div></div>
                <span className="font-site-mono text-sm font-semibold text-site-blue-lt">{s.range}</span>
              </div>
            ))}
          </Reveal>
          <div className="mt-8 flex flex-wrap items-baseline gap-4 rounded-2xl border border-site-blue-lt/30 bg-site-blue/10 px-6 py-6">
            <span className="font-site-display text-5xl font-extrabold text-site-blue-lt">{h.funnel.closeRate}</span>
            <span className="max-w-md text-sm leading-6 text-white/70">{h.funnel.closeLabel}</span>
            <span className="ml-auto font-site-mono text-xs text-white/45">{h.funnel.formula}</span>
          </div>
          <p className="mt-5 max-w-3xl font-site-mono text-[11px] leading-5 text-white/45">{h.funnel.footnote}</p>

          {/* The iCapOS delta — where the two FIXABLE causes move the number.
              Visually distinct; modeled, not measured; range from
              data/funnel-delta.json (brief Step 4). Omitted until populated. */}
          {delta ? (
            <div className="mt-8 rounded-2xl border-2 border-site-blue-lt bg-site-blue/20 px-6 py-7">
              <div className="font-site-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-site-blue-lt">The iCapOS delta · modeled, not measured</div>
              <div className="mt-3 flex flex-wrap items-baseline gap-4">
                <span className="font-site-display text-5xl font-extrabold text-white">{delta.delta_range}</span>
                <span className="max-w-md text-sm leading-6 text-white/80">where addressing the two fixable causes — thesis mismatch and readiness failures — moves the end-to-end number.</span>
              </div>
              <p className="mt-4 font-site-mono text-[11px] leading-5 text-white/55">Assumption: {delta.assumption}</p>
            </div>
          ) : null}
        </div>
      </section>

      {/* Four causes */}
      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <Eyebrow>{h.causes.eyebrow}</Eyebrow>
          <h2 className="mt-3 font-site-display text-3xl font-extrabold tracking-tight text-site-navy sm:text-4xl">{h.causes.title}</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {h.causes.items.map((c) => (
              <div key={c.h} className={`rounded-2xl border p-6 ${c.fixable ? "border-site-blue/30 bg-site-blue-pale/40" : "border-site-line bg-site-paper"}`}>
                <span className={`font-site-mono text-[10px] font-semibold uppercase tracking-wider ${c.fixable ? "text-site-blue" : "text-site-muted"}`}>{c.tag}</span>
                <h3 className="mt-2 font-site-display text-lg font-bold text-site-navy">{c.h}</h3>
                <p className="mt-2 text-sm leading-6 text-site-muted">{c.p}</p>
                <p className={`mt-3 text-[13px] font-medium ${c.fixable ? "text-site-blue" : "text-site-muted"}`}>{c.note}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 rounded-xl border border-site-line bg-site-paper px-5 py-4 text-[13px] leading-6 text-site-muted">{h.causes.thesis}</p>
        </div>
      </section>

      {/* Readiness split with the three headline metrics */}
      <section className="bg-site-paper px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid items-start gap-12 lg:grid-cols-2">
            <div>
              <Eyebrow>{h.readiness.eyebrow}</Eyebrow>
              <h2 className="mt-3 font-site-display text-3xl font-extrabold tracking-tight text-site-navy sm:text-4xl">{h.readiness.title}</h2>
              {h.readiness.paras.map((p, i) => (<p key={i} className="mt-4 text-[15px] leading-7 text-site-muted">{p}</p>))}
              <Link href={h.readiness.cta.href} className="mt-6 inline-block rounded-lg bg-site-blue px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi">{h.readiness.cta.label}</Link>
            </div>
            <div className="rounded-2xl border border-site-line bg-white p-6">
              <div className="flex items-baseline justify-between">
                <span className="font-site-mono text-xs uppercase tracking-wider text-site-muted">{h.readiness.cardTitle}</span>
                <span className="font-site-mono text-sm text-site-muted">{h.readiness.cardScore} <span className="text-site-muted/60">/100 · {h.readiness.cardBand}</span></span>
              </div>
              <div className="mt-4 space-y-3">
                {h.readiness.areas.map((a) => (
                  <div key={a.label}>
                    <div className="flex justify-between text-[13px] text-site-ink"><span>{a.label}</span><span className="font-site-mono text-site-muted">{a.score}</span></div>
                    <div className="mt-1 h-1.5 rounded-full bg-site-line"><div className="h-full rounded-full bg-site-blue" style={{ width: `${a.score}%` }} /></div>
                  </div>
                ))}
              </div>
              <p className="mt-4 font-site-mono text-[10px] text-site-muted/70">{h.readiness.cardNote}</p>
            </div>
          </div>
          {/* Targets, not results — methodology sits immediately above the figures
              so nothing below contradicts them (brief Step 3). Ranges + the
              engagement-traction line are unchanged (in modeledNote). */}
          <div className="mt-12">
            <p className="font-site-mono text-xs font-semibold uppercase tracking-[0.16em] text-site-blue">What we&apos;re building toward</p>
            <p className="mt-3 max-w-3xl text-[12px] leading-5 text-site-muted/80">{h.readiness.modeledNote}</p>
            <div className="mt-6 grid gap-6 sm:grid-cols-3">
              {h.readiness.metrics.map((m) => (
                <div key={m.value} className="rounded-2xl border border-site-line bg-white p-6">
                  <div className="font-site-display text-3xl font-extrabold text-site-blue">{m.value}</div>
                  <p className="mt-2 text-[13px] leading-6 text-site-muted">{m.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Two sides */}
      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <Eyebrow>{h.twoSides.eyebrow}</Eyebrow>
          <h2 className="mt-3 font-site-display text-3xl font-extrabold tracking-tight text-site-navy sm:text-4xl">{h.twoSides.title}</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {[h.twoSides.founders, h.twoSides.investors].map((side) => (
              <div key={side.h} className="rounded-2xl border border-site-line bg-site-paper p-7">
                <h3 className="font-site-display text-xl font-bold text-site-navy">{side.h}</h3>
                <p className="mt-2 text-sm leading-6 text-site-muted">{side.p}</p>
                <ul className="mt-4 space-y-2">
                  {side.points.map((pt) => (<li key={pt} className="flex gap-2 text-[13px] text-site-ink"><span className="text-site-blue">✓</span>{pt}</li>))}
                </ul>
                <Link href={side.cta.href} className="mt-5 inline-block rounded-lg border border-site-line bg-white px-4 py-2 text-sm font-semibold text-site-navy transition-colors hover:border-site-blue-hi hover:text-site-blue-hi">{side.cta.label}</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery / next event */}
      <section className="bg-site-paper px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <Eyebrow>{h.events.eyebrow}</Eyebrow>
          <h2 className="mt-3 font-site-display text-3xl font-extrabold tracking-tight text-site-navy sm:text-4xl">{h.events.title}</h2>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-site-muted">{h.events.sub}</p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {h.events.formats.map((f) => (
              <div key={f.h} className="rounded-2xl border border-site-line bg-white p-6"><h3 className="font-site-display text-base font-bold text-site-navy">{f.h}</h3><p className="mt-2 text-sm leading-6 text-site-muted">{f.p}</p></div>
            ))}
          </div>
          <EventGallery caption={h.events.caption} />
          <div className="mt-8 flex flex-wrap items-center gap-4 rounded-2xl border border-site-blue/30 bg-white px-6 py-6">
            <div>
              <span className="font-site-mono text-xs uppercase tracking-wider text-site-blue">{h.events.nextEvent.label}</span>
              <div className="mt-1 font-site-display text-lg font-bold text-site-navy">{h.events.nextEvent.title}</div>
              <p className="mt-1 max-w-2xl text-[13px] leading-6 text-site-muted">{h.events.nextEvent.detail}</p>
            </div>
            <Link href={h.events.nextEvent.cta.href} className="ml-auto rounded-lg bg-site-blue px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi">{h.events.nextEvent.cta.label}</Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <Eyebrow>{h.testimonials.eyebrow}</Eyebrow>
          <h2 className="mt-3 font-site-display text-3xl font-extrabold tracking-tight text-site-navy sm:text-4xl">{h.testimonials.title}</h2>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-site-muted">{h.testimonials.intro}</p>
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {h.testimonials.quotes.map((q) => (
              <figure key={q.initials} className="rounded-2xl border border-site-line bg-site-paper p-6">
                <blockquote className="text-[14px] leading-7 text-site-ink">“{q.quote}”</blockquote>
                <figcaption className="mt-4 flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-site-blue-pale font-site-mono text-xs font-semibold text-site-blue">{q.initials}</span>
                  <span className="text-[13px]"><span className="font-medium text-site-navy">{q.name}</span><br /><span className="text-site-muted">{q.title}</span></span>
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="mt-6 max-w-3xl text-[12px] leading-5 text-site-muted/80">{h.testimonials.disclaimer}</p>
        </div>
      </section>

      {/* Pull quote */}
      <section className="bg-site-navy px-6 py-16 text-white">
        <blockquote className="mx-auto max-w-3xl text-center font-site-display text-2xl font-bold leading-relaxed sm:text-3xl">“{h.pullQuote}”</blockquote>
      </section>

      {/* Closing CTA */}
      <section className="bg-gradient-to-b from-site-navy-2 to-site-navy px-6 py-20 text-center text-white">
        <div className="mx-auto max-w-3xl">
          <Eyebrow onDark>{h.closing.pre}</Eyebrow>
          <h2 className="mt-3 font-site-display text-3xl font-extrabold tracking-tight sm:text-4xl">{h.closing.title}</h2>
          <p className="mt-4 text-lg text-white/70">{h.closing.sub}</p>
          <Link href={h.closing.cta.href} className="mt-8 inline-block rounded-lg bg-site-blue px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi">{h.closing.cta.label}</Link>
        </div>
      </section>
    </>
  );
}
