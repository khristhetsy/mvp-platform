import type { Metadata } from "next";
import Link from "next/link";
import { aiAgents } from "@/content/ai-agents";
import { JsonLd } from "@/components/seo/JsonLd";
import { BookDemoButton } from "@/components/marketing-site/BookDemoButton";

export const metadata: Metadata = {
  title: "AI Agents | iCapOS",
  description:
    "AI agents that help founders get investable. Start with a free AI due diligence report, then add an Investor Relations Agent that talks to investors and books the call.",
  alternates: { canonical: "/ai-agents" },
};

const Eyebrow = ({ children, onDark = false }: { children: React.ReactNode; onDark?: boolean }) => (
  <p className={`font-site-mono text-xs font-semibold uppercase tracking-[0.16em] ${onDark ? "text-site-blue-lt" : "text-site-blue"}`}>{children}</p>
);

export default function AiAgentsPage() {
  const a = aiAgents;
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: a.faq.items.map((i) => ({
      "@type": "Question",
      name: i.q,
      acceptedAnswer: { "@type": "Answer", text: i.a },
    })),
  };

  return (
    <>
      <JsonLd data={faqJsonLd} />

      {/* Hero */}
      <section className="bg-gradient-to-b from-site-navy to-site-navy-2 px-6 pb-20 pt-20 text-white">
        <div className="mx-auto max-w-5xl text-center">
          <Eyebrow onDark>{a.hero.eyebrow}</Eyebrow>
          <h1 className="mt-3 font-site-display text-4xl font-extrabold tracking-tight sm:text-5xl">{a.hero.title}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-white/70">{a.hero.sub}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href={a.hero.primaryCta.href} className="rounded-lg bg-site-blue px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi">{a.hero.primaryCta.label}</Link>
            <Link href={a.hero.secondaryCta.href} className="rounded-lg border border-white/20 px-6 py-3 text-sm font-semibold text-white transition-colors hover:border-site-blue-lt hover:text-site-blue-lt">{a.hero.secondaryCta.label}</Link>
            <BookDemoButton variant="onDark" />
          </div>
        </div>
      </section>

      {/* Agents that exist today */}
      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <Eyebrow>{a.agents.eyebrow}</Eyebrow>
          <h2 className="mt-3 font-site-display text-3xl font-extrabold tracking-tight text-site-navy sm:text-4xl">{a.agents.title}</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {a.agents.items.map((i) => (
              <div key={i.h} className="flex flex-col rounded-2xl border border-site-line bg-site-paper p-6">
                <span className="w-fit rounded-full bg-site-blue/10 px-3 py-1 font-site-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-site-blue">{i.tag}</span>
                <h3 className="mt-4 font-site-display text-xl font-bold text-site-navy">{i.h}</h3>
                <p className="mt-2 flex-1 text-[15px] leading-7 text-site-ink/80">{i.p}</p>
                <Link href={i.cta.href} className="mt-5 w-fit rounded-lg bg-site-blue px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi">{i.cta.label}</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-site-paper px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <Eyebrow>{a.how.eyebrow}</Eyebrow>
          <h2 className="mt-3 font-site-display text-3xl font-extrabold tracking-tight text-site-navy sm:text-4xl">{a.how.title}</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {a.how.items.map((i, n) => (
              <div key={i.h} className="rounded-2xl border border-site-line bg-white p-6">
                <p className="font-site-mono text-xs font-semibold text-site-blue">{`0${n + 1}`}</p>
                <h3 className="mt-2 font-site-display text-lg font-bold text-site-navy">{i.h}</h3>
                <p className="mt-2 text-[15px] leading-7 text-site-ink/80">{i.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-site-display text-3xl font-extrabold tracking-tight text-site-navy">{a.faq.title}</h2>
          <div className="mt-8 space-y-3">
            {a.faq.items.map((i) => (
              <details key={i.q} className="rounded-xl border border-site-line bg-site-paper p-5">
                <summary className="cursor-pointer text-[15px] font-semibold text-site-navy">{i.q}</summary>
                <p className="mt-3 text-[15px] leading-7 text-site-ink/80">{i.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="bg-site-navy px-6 py-16 text-center text-white">
        <div className="mx-auto max-w-2xl">
          <h2 className="font-site-display text-3xl font-extrabold tracking-tight">{a.cta.title}</h2>
          <p className="mt-3 text-white/70">{a.cta.sub}</p>
          <Link href={a.cta.primary.href} className="mt-6 inline-block rounded-lg bg-site-blue px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi">{a.cta.primary.label}</Link>
          <p className="mx-auto mt-8 max-w-2xl text-[12px] leading-5 text-white/50">{a.compliance}</p>
        </div>
      </section>
    </>
  );
}
