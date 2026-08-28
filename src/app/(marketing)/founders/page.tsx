import type { Metadata } from "next";
import Link from "next/link";
import { founders } from "@/content/founders";
import { BookDemoButton } from "@/components/marketing-site/BookDemoButton";
import { OnePagerDrafter } from "@/components/marketing-site/OnePagerDrafter";

export const metadata: Metadata = {
  title: "For founders — iCapOS",
  description:
    "Investor relations from iCFO Capital. Get in front of matched investors from a 6,000+ network built over 16 years. Every company is rated first — that's why the network opens. Run the outreach yourself, or we run it for you. Paid plans from $499/mo.",
  alternates: { canonical: "/founders" },
};

const Eyebrow = ({ children, onDark = false }: { children: React.ReactNode; onDark?: boolean }) => (
  <p className={`font-site-mono text-xs font-semibold uppercase tracking-[0.16em] ${onDark ? "text-site-blue-lt" : "text-site-blue"}`}>{children}</p>
);

export default function FoundersPage() {
  const f = founders;
  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-b from-site-navy to-site-navy-2 px-6 pb-16 pt-20 text-white">
        <div className="mx-auto max-w-4xl">
          <Eyebrow onDark>{f.hero.eyebrow}</Eyebrow>
          <h1 className="mt-4 max-w-3xl font-site-display text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">{f.hero.title}</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/75">{f.hero.sub}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={f.hero.primaryCta.href} className="rounded-lg bg-site-blue px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi">{f.hero.primaryCta.label}</Link>
            <Link href={f.hero.secondaryCta.href} className="rounded-lg border border-white/20 px-5 py-3 text-sm font-semibold text-white transition-colors hover:border-site-blue-lt hover:text-site-blue-lt">{f.hero.secondaryCta.label}</Link>
            <BookDemoButton variant="onDark" />
          </div>
        </div>
      </section>

      {/* What you get */}
      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <Eyebrow>{f.whatYouGet.eyebrow}</Eyebrow>
          <h2 className="mt-3 font-site-display text-3xl font-extrabold tracking-tight text-site-navy sm:text-4xl">{f.whatYouGet.title}</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {f.whatYouGet.items.map((i) => (
              <div key={i.h} className="rounded-2xl border border-site-line bg-site-paper p-6">
                <h3 className="font-site-display text-lg font-bold text-site-navy">{i.h}</h3>
                <p className="mt-2 text-sm leading-6 text-site-muted">{i.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The heavy lifting split */}
      <section className="bg-site-navy px-6 py-20 text-white">
        <div className="mx-auto max-w-6xl">
          <Eyebrow onDark>{f.heavyLifting.eyebrow}</Eyebrow>
          <h2 className="mt-3 font-site-display text-3xl font-extrabold tracking-tight sm:text-4xl">{f.heavyLifting.title}</h2>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-white/70">{f.heavyLifting.intro}</p>
          <div className="mt-10 grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div className="rounded-2xl border border-site-blue-lt/25 bg-site-blue/10 p-6">
              <div className="font-site-display text-lg font-bold">{f.heavyLifting.doesTitle}</div>
              <div className="font-site-mono text-xs uppercase tracking-wider text-site-blue-lt">{f.heavyLifting.doesSub}</div>
              <ul className="mt-4 space-y-2.5">
                {f.heavyLifting.does.map((d) => (<li key={d} className="flex gap-2.5 text-[14px] text-white/85"><span className="text-site-blue-lt"><i className="ti ti-check" aria-hidden="true" /></span>{d}</li>))}
              </ul>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <div className="font-site-display text-lg font-bold">{f.heavyLifting.youTitle}</div>
              <div className="font-site-mono text-xs uppercase tracking-wider text-white/50">{f.heavyLifting.youSub}</div>
              <ul className="mt-4 space-y-2.5">
                {f.heavyLifting.you.map((y) => (<li key={y} className="flex gap-2.5 text-[14px] text-white/85"><span className="text-white/50">•</span>{y}</li>))}
              </ul>
            </div>
          </div>
          <p className="mt-6 max-w-3xl text-[13px] leading-6 text-white/60">{f.heavyLifting.note}</p>
          <Link href={f.heavyLifting.cta.href} className="mt-6 inline-block rounded-lg bg-site-blue px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi">{f.heavyLifting.cta.label}</Link>
        </div>
      </section>

      {/* "Nothing." */}
      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid items-start gap-10 lg:grid-cols-2">
            <div>
              <Eyebrow>{f.nothing.eyebrow}</Eyebrow>
              <div className="mt-3 font-site-display text-6xl font-extrabold tracking-tight text-site-navy">{f.nothing.big}</div>
              {f.nothing.paras.map((p, i) => (<p key={i} className="mt-4 max-w-xl text-[15px] leading-7 text-site-muted">{p}</p>))}
              <Link href={f.nothing.cta.href} className="mt-6 inline-block rounded-lg bg-site-blue px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi">{f.nothing.cta.label}</Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {f.nothing.items.map((i) => (
                <div key={i.h} className="rounded-xl border border-site-line bg-site-paper p-4">
                  <h3 className="text-sm font-semibold text-site-navy">{i.h}</h3>
                  <p className="mt-1 text-[12.5px] leading-5 text-site-muted">{i.p}</p>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-8 rounded-xl border border-site-line bg-site-paper px-5 py-4 text-[13px] leading-6 text-site-muted">{f.nothing.needNote}</p>
        </div>
      </section>

      {/* Done-for-you vs DIY */}
      <section className="bg-site-paper px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <Eyebrow>{f.twoWays.eyebrow}</Eyebrow>
          <h2 className="mt-3 font-site-display text-3xl font-extrabold tracking-tight text-site-navy sm:text-4xl">{f.twoWays.title}</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {[f.twoWays.dfy, f.twoWays.diy].map((w) => (
              <div key={w.h} className="rounded-2xl border border-site-line bg-white p-7">
                <h3 className="font-site-display text-xl font-bold text-site-navy">{w.h}</h3>
                <p className="mt-2 text-sm leading-6 text-site-muted">{w.p}</p>
                <ul className="mt-4 space-y-2">
                  {w.points.map((pt) => (<li key={pt} className="flex gap-2 text-[13px] text-site-ink"><span className="text-site-blue"><i className="ti ti-check" aria-hidden="true" /></span>{pt}</li>))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-8 rounded-2xl border border-site-line bg-white px-6 py-6">
            <h3 className="font-site-display text-lg font-bold text-site-navy">{f.twoWays.capTitle}</h3>
            {f.twoWays.capParas.map((p, i) => (<p key={i} className="mt-2 max-w-3xl text-[14px] leading-6 text-site-muted">{p}</p>))}
          </div>
        </div>
      </section>

      {/* AI drafting — shapes the founder's own inputs into a starting one-pager (§5, §7) */}
      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <Eyebrow>{f.drafting.eyebrow}</Eyebrow>
            <h2 className="mt-3 font-site-display text-3xl font-extrabold tracking-tight text-site-navy sm:text-4xl">{f.drafting.title}</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-site-muted">{f.drafting.sub}</p>
          </div>
          <div className="mt-8">
            <OnePagerDrafter />
          </div>
          <p className="mx-auto mt-4 max-w-xl text-center text-[12px] leading-5 text-site-muted/80">{f.drafting.disclaimer}</p>
        </div>
      </section>

      {/* Closing CTA (with required Founders → Events cross-link, §3) */}
      <section className="bg-gradient-to-b from-site-navy-2 to-site-navy px-6 py-20 text-center text-white">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-site-display text-3xl font-extrabold tracking-tight sm:text-4xl">{f.closing.title}</h2>
          <p className="mt-4 text-lg text-white/70">{f.closing.sub}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href={f.closing.primaryCta.href} className="rounded-lg bg-site-blue px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi">{f.closing.primaryCta.label}</Link>
            <Link href={f.closing.secondaryCta.href} className="rounded-lg border border-white/20 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:border-site-blue-lt hover:text-site-blue-lt">{f.closing.secondaryCta.label}</Link>
          </div>
          <p className="mt-6 text-sm">
            <Link href={f.closing.eventsCta.href} className="font-medium text-site-blue-lt underline-offset-4 hover:underline">{f.closing.eventsCta.label} →</Link>
          </p>
        </div>
      </section>
    </>
  );
}
