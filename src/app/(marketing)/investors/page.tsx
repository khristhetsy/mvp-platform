import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { investors } from "@/content/investors";
import { MandateExplorer } from "@/components/marketing-site/MandateExplorer";

export const metadata: Metadata = {
  title: "For investors — iCapOS",
  description:
    "Rated deal flow, at a volume you set. Free accounts, your mandate, your monthly cap — every company arrives with a readiness rating attached. iCapOS is indication-only; no transactions are processed.",
  alternates: { canonical: "/investors" },
};

const Eyebrow = ({ children, onDark = false }: { children: React.ReactNode; onDark?: boolean }) => (
  <p className={`font-site-mono text-xs font-semibold uppercase tracking-[0.16em] ${onDark ? "text-site-blue-lt" : "text-site-blue"}`}>{children}</p>
);

export default function InvestorsPage() {
  const v = investors;
  return (
    <>
      {/* Hero banner (artwork carries the headline; real links and compliance text sit beneath it) */}
      <section className="bg-site-navy text-white">
        <h1 className="sr-only">{v.hero.title}</h1>
        <Image
          src="/marketing/banners/investors-hero.webp"
          alt="For investors: rated deal flow, at a volume you set. iCapOS AI due diligence, readiness scores and curated deal flow."
          width={2103}
          height={748}
          priority
          sizes="100vw"
          className="mx-auto h-auto w-full max-w-[2100px]"
        />
        <div className="mx-auto max-w-6xl px-6 pb-12 pt-6">
          <div className="flex flex-wrap gap-3">
            <Link href={v.hero.primaryCta.href} className="rounded-lg bg-site-blue px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi">{v.hero.primaryCta.label}</Link>
            <Link href={v.hero.secondaryCta.href} className="rounded-lg border border-white/20 px-5 py-3 text-sm font-semibold text-white transition-colors hover:border-site-blue-lt hover:text-site-blue-lt">{v.hero.secondaryCta.label}</Link>
          </div>
          <p className="mt-6 max-w-3xl font-site-mono text-[11px] leading-5 text-white/45">{v.hero.compliance}</p>
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

      {/* Mandate parser + live match explorer (§5, §7 — fictional samples only) */}
      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <Eyebrow>{v.explorer.eyebrow}</Eyebrow>
          <h2 className="mt-3 font-site-display text-3xl font-extrabold tracking-tight text-site-navy sm:text-4xl">{v.explorer.title}</h2>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-site-muted">{v.explorer.sub}</p>
          <MandateExplorer
            parseLabel={v.explorer.parseLabel}
            parseChips={v.explorer.parseChips}
            parseCta={v.explorer.parseCta}
            filters={v.explorer.filters}
            note={v.explorer.note}
          />
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
