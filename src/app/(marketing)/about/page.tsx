import type { Metadata } from "next";
import Link from "next/link";
import { about } from "@/content/about";
import { JsonLd } from "@/components/seo/JsonLd";
import { ORGANIZATION_JSONLD } from "@/lib/seo/structured-data";

export const metadata: Metadata = {
  title: "About us — iCFO Capital Global, Inc.",
  description:
    "Sixteen years of investor relations, now running as software. iCFO Capital Global built the investor network, the conference series, and the readiness practice that iCapOS systematizes. Delaware corporation, La Jolla, California.",
  alternates: { canonical: "/about" },
};

const Eyebrow = ({ children, onDark = false }: { children: React.ReactNode; onDark?: boolean }) => (
  <p className={`font-site-mono text-xs font-semibold uppercase tracking-[0.16em] ${onDark ? "text-site-blue-lt" : "text-site-blue"}`}>{children}</p>
);
const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mt-3 font-site-display text-3xl font-extrabold tracking-tight text-site-navy sm:text-4xl">{children}</h2>
);

export default function AboutPage() {
  const a = about;
  return (
    <>
      <JsonLd data={ORGANIZATION_JSONLD} />

      {/* Hero */}
      <section className="bg-gradient-to-b from-site-navy to-site-navy-2 px-6 pb-14 pt-20 text-white">
        <div className="mx-auto max-w-4xl">
          <Eyebrow onDark>{a.hero.eyebrow}</Eyebrow>
          <h1 className="mt-4 max-w-3xl font-site-display text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">{a.hero.title}</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/75">{a.hero.sub}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={a.hero.primaryCta.href} className="rounded-lg bg-site-blue px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi">{a.hero.primaryCta.label}</Link>
            <Link href={a.hero.secondaryCta.href} className="rounded-lg border border-white/20 px-5 py-3 text-sm font-semibold text-white transition-colors hover:border-site-blue-lt hover:text-site-blue-lt">{a.hero.secondaryCta.label}</Link>
          </div>
        </div>
      </section>

      {/* Stat band */}
      <section className="border-b border-site-line bg-site-navy-3 px-6 py-8 text-white">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-baseline gap-3"><span className="font-site-display text-sm font-bold">{a.statBand.heading}</span><span className="font-site-mono text-xs text-white/50">{a.statBand.est}</span></div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {a.statBand.stats.map((s) => (<div key={s.k}><div className="font-site-display text-lg font-extrabold text-site-blue-lt">{s.v}</div><div className="mt-0.5 text-[12px] text-white/60">{s.k}</div></div>))}
          </div>
        </div>
      </section>

      {/* What we've built */}
      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <Eyebrow>{a.whatBuilt.eyebrow}</Eyebrow>
          <H2>{a.whatBuilt.title}</H2>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-site-muted">{a.whatBuilt.intro}</p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {a.whatBuilt.items.map((i) => (<div key={i.n} className="rounded-2xl border border-site-line bg-site-paper p-6"><div className="font-site-mono text-2xl font-semibold text-site-blue">{i.n}</div><h3 className="mt-3 font-site-display text-lg font-bold text-site-navy">{i.h}</h3><p className="mt-2 text-sm leading-6 text-site-muted">{i.p}</p></div>))}
          </div>
        </div>
      </section>

      {/* Pillar one */}
      <section className="bg-site-paper px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <Eyebrow>{a.pillar1.eyebrow}</Eyebrow>
          <H2>{a.pillar1.title}</H2>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-site-muted">{a.pillar1.intro}</p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {a.pillar1.items.map((i) => (<div key={i.tag} className="flex gap-4 rounded-2xl border border-site-line bg-white p-6"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-site-blue-pale font-site-mono text-sm font-semibold text-site-blue">{i.tag}</span><div><h3 className="font-site-display text-base font-bold text-site-navy">{i.h}</h3><p className="mt-1 text-sm leading-6 text-site-muted">{i.p}</p></div></div>))}
          </div>
          <p className="mt-8 rounded-xl border border-site-line bg-white px-5 py-4 text-[13px] leading-6 text-site-muted">{a.pillar1.note}</p>
        </div>
      </section>

      {/* Pillar two + network composition */}
      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <Eyebrow>{a.pillar2.eyebrow}</Eyebrow>
          <H2>{a.pillar2.title}</H2>
          {a.pillar2.paras.map((p, i) => (<p key={i} className="mt-4 max-w-3xl text-[15px] leading-7 text-site-muted">{p}</p>))}
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">{a.pillar2.points.map((p) => (<li key={p} className="flex gap-2 text-[14px] text-site-ink"><span className="text-site-blue">✓</span>{p}</li>))}</ul>
          <div className="mt-8 overflow-hidden rounded-2xl border border-site-line">
            <div className="flex items-baseline justify-between bg-site-paper px-5 py-3"><span className="font-site-display text-sm font-bold text-site-navy">{a.pillar2.composition.title}</span><span className="text-[12px] text-site-muted">{a.pillar2.composition.sub}</span></div>
            <table className="w-full text-left text-sm">
              <thead className="bg-site-paper font-site-mono text-[11px] uppercase tracking-wide text-site-muted"><tr><th className="px-5 py-2">{a.pillar2.composition.cols[0]}</th><th className="px-5 py-2">{a.pillar2.composition.cols[1]}</th></tr></thead>
              <tbody>{a.pillar2.composition.rows.map((r) => (<tr key={r.t} className="border-t border-site-line"><td className="px-5 py-3 text-site-ink">{r.t}</td><td className="px-5 py-3 font-site-mono text-site-muted">{r.m}</td></tr>))}</tbody>
            </table>
          </div>
          <p className="mt-3 font-site-mono text-[11px] text-site-muted/80">{a.pillar2.composition.note}</p>
        </div>
      </section>

      {/* Pillar three */}
      <section className="bg-site-paper px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <Eyebrow>{a.pillar3.eyebrow}</Eyebrow>
          <H2>{a.pillar3.title}</H2>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-site-muted">{a.pillar3.intro}</p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">{a.pillar3.items.map((i) => (<div key={i.h} className="rounded-2xl border border-site-line bg-white p-6"><h3 className="font-site-display text-base font-bold text-site-navy">{i.h}</h3><p className="mt-2 text-sm leading-6 text-site-muted">{i.p}</p></div>))}</div>
          <Link href={a.pillar3.cta.href} className="mt-8 inline-block rounded-lg border border-site-line bg-white px-5 py-3 text-sm font-semibold text-site-navy transition-colors hover:border-site-blue-hi hover:text-site-blue-hi">{a.pillar3.cta.label}</Link>
        </div>
      </section>

      {/* Why iCapOS exists */}
      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <Eyebrow>{a.whyExists.eyebrow}</Eyebrow>
          <H2>{a.whyExists.title}</H2>
          {a.whyExists.paras.map((p, i) => (<p key={i} className="mt-4 text-[15px] leading-7 text-site-muted">{p}</p>))}
          <ul className="mt-4 space-y-2">{a.whyExists.points.map((p) => (<li key={p} className="flex gap-2 text-[14px] text-site-ink"><span className="text-site-blue">✓</span>{p}</li>))}</ul>
        </div>
      </section>

      {/* Honest */}
      <section className="bg-site-navy px-6 py-16 text-white">
        <div className="mx-auto max-w-4xl">
          <Eyebrow onDark>{a.honest.eyebrow}</Eyebrow>
          <h2 className="mt-3 font-site-display text-2xl font-extrabold tracking-tight sm:text-3xl">{a.honest.title}</h2>
          {a.honest.paras.map((p, i) => (<p key={i} className="mt-4 max-w-2xl text-[15px] leading-7 text-white/70">{p}</p>))}
          <p className="mt-6 rounded-xl border border-site-blue-lt/25 bg-site-blue/10 px-5 py-4 text-[14px] font-medium text-white/85">{a.honest.note}</p>
        </div>
      </section>

      {/* Timeline */}
      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <Eyebrow>{a.timeline.eyebrow}</Eyebrow>
          <H2>{a.timeline.title}</H2>
          <ol className="mt-8 space-y-6 border-l border-site-line pl-6">
            {a.timeline.items.map((t) => (<li key={t.h} className="relative"><span className="absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full bg-site-blue" /><div className="font-site-mono text-xs uppercase tracking-wider text-site-blue">{t.when}</div><h3 className="mt-1 font-site-display text-base font-bold text-site-navy">{t.h}</h3><p className="mt-1 text-sm leading-6 text-site-muted">{t.p}</p></li>))}
          </ol>
          <p className="mt-6 font-site-mono text-[11px] text-site-muted/80">{a.timeline.note}</p>
        </div>
      </section>

      {/* Offices */}
      <section className="bg-site-paper px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <Eyebrow>{a.offices.eyebrow}</Eyebrow>
          <H2>{a.offices.title}</H2>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-site-muted">{a.offices.sub}</p>
          <div className="mt-8 flex flex-wrap gap-3">{a.offices.cities.map((c) => (<span key={c} className="rounded-lg border border-site-line bg-white px-4 py-2 text-sm font-medium text-site-navy">{c}</span>))}</div>
        </div>
      </section>

      {/* Commitments */}
      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <Eyebrow>{a.commitments.eyebrow}</Eyebrow>
          <H2>{a.commitments.title}</H2>
          <div className="mt-10 grid gap-6 md:grid-cols-2">{a.commitments.items.map((i) => (<div key={i.h} className="rounded-2xl border border-site-line bg-site-paper p-6"><h3 className="font-site-display text-lg font-bold text-site-navy">{i.h}</h3><p className="mt-2 text-sm leading-6 text-site-muted">{i.p}</p></div>))}</div>
        </div>
      </section>

      {/* Leadership (bio slots are known §17 gaps) */}
      <section className="bg-site-paper px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <Eyebrow>{a.leadership.eyebrow}</Eyebrow>
          <H2>{a.leadership.title}</H2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {a.leadership.people.map((p) => (
              <div key={p.name} className="rounded-2xl border border-site-line bg-white p-6">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-site-blue-pale font-site-mono text-sm font-semibold text-site-blue">{p.initials}</span>
                <h3 className="mt-4 font-site-display text-lg font-bold text-site-navy">{p.name}</h3>
                <div className="text-[13px] text-site-muted">{p.role}</div>
                <p className="mt-3 text-sm leading-6 text-site-muted">{p.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
