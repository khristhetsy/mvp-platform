import type { Metadata } from "next";
import Link from "next/link";
import { investors } from "@/content/investors";

export const metadata: Metadata = {
  title: "For investors — iCapOS",
  description:
    "Rated deal flow, at a volume you set. Free accounts, your mandate, your monthly cap — every company arrives with a readiness rating attached. iCapOS is pledge-only; no transactions are processed.",
  alternates: { canonical: "/investors" },
};

const Eyebrow = ({ children, onDark = false }: { children: React.ReactNode; onDark?: boolean }) => (
  <p className={`font-site-mono text-xs font-semibold uppercase tracking-[0.16em] ${onDark ? "text-site-blue-lt" : "text-site-blue"}`}>{children}</p>
);

export default function InvestorsPage() {
  const v = investors;
  return (
    <>
      {/* Hero + volume-cap panel */}
      <section className="bg-gradient-to-b from-site-navy via-site-navy-2 to-site-navy-3 px-6 pb-16 pt-20 text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <div>
            <Eyebrow onDark>{v.hero.eyebrow}</Eyebrow>
            <h1 className="mt-4 font-site-display text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">{v.hero.title}</h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/75">{v.hero.sub}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={v.hero.primaryCta.href} className="rounded-lg bg-site-blue px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi">{v.hero.primaryCta.label}</Link>
              <Link href={v.hero.secondaryCta.href} className="rounded-lg border border-white/20 px-5 py-3 text-sm font-semibold text-white transition-colors hover:border-site-blue-lt hover:text-site-blue-lt">{v.hero.secondaryCta.label}</Link>
            </div>
            <p className="mt-8 max-w-xl font-site-mono text-[11px] leading-5 text-white/45">{v.hero.compliance}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white">{v.hero.panel.title}</span>
              <span className="rounded-full bg-site-blue/20 px-2.5 py-0.5 font-site-mono text-[10px] font-medium text-site-blue-lt">{v.hero.panel.badge}</span>
            </div>
            <div className="mt-4 rounded-xl bg-white/[0.03] px-4 py-3">
              <div className="flex items-center justify-between text-[13px]"><span className="text-white/70">{v.hero.panel.cap.label}</span><span className="font-site-mono text-white/50">{v.hero.panel.cap.max}</span></div>
              <div className="mt-1 font-site-mono text-[11px] text-white/45">{v.hero.panel.cap.sub}</div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-site-blue" style={{ width: "58%" }} /></div>
            </div>
            <dl className="mt-3 space-y-2">
              {v.hero.panel.rows.map((r) => (
                <div key={r.k} className="flex justify-between gap-4 border-b border-white/5 pb-2 text-[13px] last:border-0">
                  <dt className="text-white/55">{r.k}</dt><dd className="text-right text-white/85">{r.v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 flex items-center justify-between font-site-mono text-[10px] text-white/40"><span>{v.hero.panel.footA}</span><span>{v.hero.panel.footB}</span></div>
          </div>
        </div>
      </section>

      {/* The problem + three metrics */}
      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <Eyebrow>{v.problem.eyebrow}</Eyebrow>
          <h2 className="mt-3 font-site-display text-3xl font-extrabold tracking-tight text-site-navy sm:text-4xl">{v.problem.title}</h2>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-site-muted">{v.problem.intro}</p>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {v.problem.items.map((i) => (
              <div key={i.h} className="rounded-2xl border border-site-line bg-site-paper p-6">
                <h3 className="font-site-display text-lg font-bold text-site-navy">{i.h}</h3>
                <p className="mt-2 text-sm leading-6 text-site-muted">{i.p}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {v.problem.metrics.map((m) => (
              <div key={m.value} className="rounded-2xl border border-site-line bg-white p-6"><div className="font-site-display text-3xl font-extrabold text-site-blue">{m.value}</div><p className="mt-2 text-[13px] leading-6 text-site-muted">{m.label}</p></div>
            ))}
          </div>
          <p className="mt-6 max-w-3xl text-[12px] leading-5 text-site-muted/80">{v.problem.modeledNote}</p>
        </div>
      </section>

      {/* Why the cap exists */}
      <section className="bg-site-paper px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <Eyebrow>{v.cap.eyebrow}</Eyebrow>
          <h2 className="mt-3 font-site-display text-3xl font-extrabold tracking-tight text-site-navy sm:text-4xl">{v.cap.title}</h2>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-site-muted">{v.cap.intro}</p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {v.cap.items.map((i) => (
              <div key={i.h} className="rounded-2xl border border-site-line bg-white p-6"><h3 className="font-site-display text-lg font-bold text-site-navy">{i.h}</h3><p className="mt-2 text-sm leading-6 text-site-muted">{i.p}</p></div>
            ))}
          </div>
        </div>
      </section>

      {/* Mandate parser + match explorer (interactive/AI-wired in a later step) */}
      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <Eyebrow>{v.explorer.eyebrow}</Eyebrow>
          <h2 className="mt-3 font-site-display text-3xl font-extrabold tracking-tight text-site-navy sm:text-4xl">{v.explorer.title}</h2>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-site-muted">{v.explorer.sub}</p>
          <div className="mt-8 rounded-2xl border border-site-line bg-site-paper p-6">
            <label className="text-sm font-medium text-site-navy">{v.explorer.parseLabel}</label>
            <div className="mt-3 flex flex-wrap gap-2">
              {v.explorer.parseChips.map((c) => (<span key={c} className="rounded-full border border-site-line bg-white px-3 py-1 text-[13px] text-site-ink">{c}</span>))}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {v.explorer.filters.map((fl) => (
                <label key={fl.label} className="text-[13px] text-site-muted">{fl.label}
                  <select className="mt-1 w-full rounded-lg border border-site-line bg-white px-3 py-2 text-sm text-site-ink">
                    {fl.options.map((o) => (<option key={o}>{o}</option>))}
                  </select>
                </label>
              ))}
            </div>
            <button type="button" className="mt-4 rounded-lg bg-site-blue px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi">{v.explorer.parseCta}</button>
            <p className="mt-4 font-site-mono text-[11px] text-site-muted/70">{v.explorer.note}</p>
          </div>
        </div>
      </section>

      {/* Investor workspace */}
      <section className="bg-site-navy px-6 py-20 text-white">
        <div className="mx-auto max-w-6xl">
          <Eyebrow onDark>{v.workspace.eyebrow}</Eyebrow>
          <h2 className="mt-3 font-site-display text-3xl font-extrabold tracking-tight sm:text-4xl">{v.workspace.title}</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {v.workspace.items.map((i) => (
              <div key={i.h} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <div className="flex items-center gap-2">
                  <h3 className="font-site-display text-lg font-bold">{i.h}</h3>
                  {"tag" in i && i.tag ? <span className="rounded-full bg-site-blue/20 px-2 py-0.5 font-site-mono text-[10px] font-medium text-site-blue-lt">{i.tag}</span> : null}
                </div>
                <p className="mt-2 text-sm leading-6 text-white/70">{i.p}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 max-w-3xl font-site-mono text-[11px] leading-5 text-white/45">{v.workspace.notDo}</p>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="bg-gradient-to-b from-site-navy-2 to-site-navy px-6 py-20 text-center text-white">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-site-display text-3xl font-extrabold tracking-tight sm:text-4xl">{v.closing.title}</h2>
          <p className="mt-4 text-lg text-white/70">{v.closing.sub}</p>
          <Link href={v.closing.cta.href} className="mt-8 inline-block rounded-lg bg-site-blue px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi">{v.closing.cta.label}</Link>
        </div>
      </section>
    </>
  );
}
