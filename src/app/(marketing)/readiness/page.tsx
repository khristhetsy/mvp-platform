import type { Metadata } from "next";
import Link from "next/link";
import { readiness } from "@/content/readiness";

export const metadata: Metadata = {
  title: "Capital Readiness Rating — iCapOS",
  description:
    "A free, structured readiness score across five dimensions investors screen on, with an ordered list of what to fix. Run it with whatever you have today — readiness is what iCapOS produces, not what it requires.",
  alternates: { canonical: "/readiness" },
};

const Eyebrow = ({ children, onDark = false }: { children: React.ReactNode; onDark?: boolean }) => (
  <p className={`font-site-mono text-xs font-semibold uppercase tracking-[0.16em] ${onDark ? "text-site-blue-lt" : "text-site-blue"}`}>{children}</p>
);
const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mt-3 font-site-display text-3xl font-extrabold tracking-tight text-site-navy sm:text-4xl">{children}</h2>
);

export default function ReadinessPage() {
  const r = readiness;
  return (
    <>
      {/* Hero + sample rating */}
      <section className="bg-gradient-to-b from-site-navy to-site-navy-2 px-6 pb-16 pt-20 text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <div>
            <Eyebrow onDark>{r.hero.eyebrow}</Eyebrow>
            <h1 className="mt-4 font-site-display text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">{r.hero.title}</h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/75">{r.hero.sub}</p>
            <Link href={r.hero.cta.href} className="mt-8 inline-block rounded-lg bg-site-blue px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi">{r.hero.cta.label}</Link>
            <p className="mt-8 max-w-xl font-site-mono text-[11px] leading-5 text-white/45">{r.hero.compliance}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <div className="flex items-center justify-between"><span className="text-sm font-medium text-white">{r.sample.title}</span><span className="rounded-full bg-site-amber/15 px-2.5 py-0.5 font-site-mono text-[10px] font-medium text-site-amber">{r.sample.badge}</span></div>
            <div className="mt-3 font-site-mono text-sm text-white/60">{r.sample.score} <span className="text-white/40">/100 · {r.sample.band}</span></div>
            <div className="mt-4 space-y-3">
              {r.sample.dimensions.map((d) => (
                <div key={d.label}>
                  <div className="flex justify-between text-[13px]"><span className="text-white/85">{d.label}</span><span className="font-site-mono text-white/50">{d.score}</span></div>
                  <div className="text-[11px] text-white/40">{d.desc}</div>
                  <div className="mt-1 h-1.5 rounded-full bg-white/10"><div className="h-full rounded-full bg-site-blue-lt" style={{ width: `${d.score}%` }} /></div>
                </div>
              ))}
            </div>
            <p className="mt-4 font-site-mono text-[10px] text-white/40">{r.sample.foot}</p>
          </div>
        </div>
      </section>

      {/* AI analyzer (ReadinessAnalyzer wires here in the AI step) */}
      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>{r.analyzer.eyebrow}</Eyebrow>
          <H2>{r.analyzer.title}</H2>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-site-muted">{r.analyzer.sub}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {r.analyzer.chips.map((c) => (<span key={c} className="rounded-full border border-site-line bg-site-paper px-3 py-1 text-[13px] text-site-ink">{c}</span>))}
          </div>
          <button type="button" className="mt-5 rounded-lg bg-site-blue px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi">{r.analyzer.cta}</button>
          <p className="mx-auto mt-4 max-w-xl text-[12px] leading-5 text-site-muted/80">{r.analyzer.disclaimer}</p>
        </div>
      </section>

      {/* Estimator (ReadinessEstimator sliders wire here in the interactive step) */}
      <section className="bg-site-paper px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <Eyebrow>{r.estimator.eyebrow}</Eyebrow>
          <H2>{r.estimator.title}</H2>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-site-muted">{r.estimator.sub}</p>
          <div className="mt-8 grid gap-8 md:grid-cols-[2fr_1fr]">
            <div className="space-y-5">
              {r.estimator.dimensions.map((d) => (
                <div key={d.label}>
                  <div className="flex items-center justify-between text-[13px]"><span className="font-medium text-site-navy">{d.label} <span className="font-site-mono text-site-muted">Weight {d.weight}%</span></span><span className="font-site-mono text-site-blue">{d.value}</span></div>
                  <div className="mt-1 text-[12px] text-site-muted">{d.desc}</div>
                  <div className="mt-2 h-1.5 rounded-full bg-site-line"><div className="h-full rounded-full bg-site-blue" style={{ width: `${d.value}%` }} /></div>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-site-line bg-white p-6 text-center">
              <div className="font-site-mono text-xs uppercase tracking-wider text-site-muted">Estimated rating</div>
              <div className="mt-2 font-site-display text-5xl font-extrabold text-site-blue">{r.estimator.estimated}<span className="text-lg text-site-muted">/100</span></div>
              <div className="text-sm text-site-muted">{r.estimator.band}</div>
              <div className="mt-4 font-site-mono text-[11px] uppercase tracking-wider text-site-muted">{r.estimator.workOn}</div>
              <Link href={r.estimator.cta.href} className="mt-4 block rounded-lg bg-site-blue px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi">{r.estimator.cta.label}</Link>
            </div>
          </div>
          <p className="mt-4 font-site-mono text-[11px] text-site-muted/80">{r.estimator.disclaimer}</p>
        </div>
      </section>

      {/* What it measures */}
      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <Eyebrow>{r.measures.eyebrow}</Eyebrow>
          <H2>{r.measures.title}</H2>
          <div className="mt-8 overflow-hidden rounded-2xl border border-site-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-site-paper font-site-mono text-[11px] uppercase tracking-wide text-site-muted"><tr><th className="px-5 py-3">{r.measures.cols[0]}</th><th className="px-5 py-3">{r.measures.cols[1]}</th><th className="px-5 py-3 text-right">{r.measures.cols[2]}</th></tr></thead>
              <tbody>{r.measures.rows.map((row) => (<tr key={row.label} className="border-t border-site-line"><td className="px-5 py-3 font-medium text-site-navy">{row.label}</td><td className="px-5 py-3 text-site-muted">{row.looks}</td><td className="px-5 py-3 text-right font-site-mono text-site-blue">{row.weight}%</td></tr>))}</tbody>
            </table>
          </div>
          <p className="mt-3 font-site-mono text-[11px] text-site-muted/80">{r.measures.note}</p>
        </div>
      </section>

      {/* What you get back + Readiness → Founders/Pricing cross-links (§3) */}
      <section className="bg-site-paper px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <Eyebrow>{r.getBack.eyebrow}</Eyebrow>
          <H2>{r.getBack.title}</H2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {r.getBack.items.map((i) => (<div key={i.n} className="rounded-2xl border border-site-line bg-white p-6"><div className="font-site-mono text-2xl font-semibold text-site-blue">{i.n}</div><h3 className="mt-3 font-site-display text-base font-bold text-site-navy">{i.h}</h3><p className="mt-2 text-sm leading-6 text-site-muted">{i.p}</p></div>))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={r.getBack.founderCta.href} className="rounded-lg border border-site-line bg-white px-5 py-3 text-sm font-semibold text-site-navy transition-colors hover:border-site-blue-hi hover:text-site-blue-hi">{r.getBack.founderCta.label} →</Link>
            <Link href={r.getBack.pricingCta.href} className="rounded-lg border border-site-line bg-white px-5 py-3 text-sm font-semibold text-site-navy transition-colors hover:border-site-blue-hi hover:text-site-blue-hi">{r.getBack.pricingCta.label} →</Link>
          </div>
          <p className="mt-6 max-w-3xl text-[13px] leading-6 text-site-muted">{r.getBack.privacy}</p>
        </div>
      </section>

      {/* Closing */}
      <section className="bg-gradient-to-b from-site-navy-2 to-site-navy px-6 py-16 text-center text-white">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-site-display text-3xl font-extrabold tracking-tight sm:text-4xl">{r.closing.title}</h2>
          <p className="mt-4 text-lg text-white/70">{r.closing.sub}</p>
          <Link href={r.closing.cta.href} className="mt-8 inline-block rounded-lg bg-site-blue px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi">{r.closing.cta.label}</Link>
        </div>
      </section>
    </>
  );
}
