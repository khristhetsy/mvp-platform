import type { Metadata } from "next";
import Link from "next/link";
import { pricing } from "@/content/pricing";
import { JsonLd } from "@/components/seo/JsonLd";
import { BookDemoButton } from "@/components/marketing-site/BookDemoButton";
import { loadPriceAnchor } from "@/lib/marketing-site/price-anchor";

export const metadata: Metadata = {
  title: "Pricing — iCapOS",
  description:
    "Two plans, every tool in both. Founder Basic $499/mo (up to 25 matched investors, spotlight reel); Founder Professional $1,000/mo (up to 100, live conference slot). Investor accounts are free. No success fees.",
  alternates: { canonical: "/pricing" },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: pricing.faq.items.map((i) => ({
    "@type": "Question",
    name: i.q,
    acceptedAnswer: { "@type": "Answer", text: i.a },
  })),
};

export default function PricingPage() {
  const p = pricing;
  const anchor = loadPriceAnchor();
  return (
    <>
      <JsonLd data={faqJsonLd} />

      {/* Hero + tiers */}
      <section className="bg-gradient-to-b from-site-navy to-site-navy-2 px-6 pb-20 pt-20 text-white">
        <div className="mx-auto max-w-5xl text-center">
          <p className="font-site-mono text-xs font-semibold uppercase tracking-[0.16em] text-site-blue-lt">{p.eyebrow}</p>
          <h1 className="mt-3 font-site-display text-4xl font-extrabold tracking-tight sm:text-5xl">{p.title}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-white/70">{p.sub}</p>
          {/* Price anchor — the alternative cost of outreach (brief Step 5). Figures from data/price-anchor.json (TKTK); no competitor names. */}
          <p className="mx-auto mt-6 max-w-2xl text-[13px] leading-6 text-white/55">
            For comparison, a dedicated IR retainer runs {anchor.ir_retainer}, a purchased investor list {anchor.list_purchase}, and a placement agent typically takes {anchor.placement_pct} of the round.
          </p>
        </div>
        <div className="mx-auto mt-10 grid max-w-4xl gap-6 md:grid-cols-2">
          {p.tiers.map((t) => (
            <div key={t.name} className={`relative rounded-2xl p-7 ${t.featured ? "order-first border-2 border-site-blue-lt bg-white/[0.07] ring-1 ring-site-blue-lt/25 md:order-none" : "border border-white/12 bg-white/[0.03]"}`}>
              {/* Professional primacy tag; Professional is order-first on mobile (brief Step 6). */}
              {t.featured ? (
                <div className="absolute -top-3 left-6 rounded-full bg-site-blue px-3 py-1 font-site-mono text-[10px] font-semibold uppercase tracking-wider text-white">Most founders start here</div>
              ) : null}
              <div className="flex items-center justify-between">
                <h2 className="font-site-display text-xl font-bold">{t.name}</h2>
                {"badge" in t && t.badge ? <span className="rounded-full bg-site-blue/25 px-2.5 py-0.5 font-site-mono text-[10px] font-medium text-site-blue-lt">{t.badge}</span> : null}
              </div>
              <div className="mt-3 flex items-baseline gap-1"><span className="font-site-display text-4xl font-extrabold">{t.price}</span><span className="text-sm text-white/50">{t.per}</span></div>
              <p className="mt-2 text-sm text-white/65">{t.desc}</p>
              <ul className="mt-5 space-y-2.5">
                {t.features.map((f) => (<li key={f} className="flex gap-2.5 text-[13.5px] text-white/85"><span className="text-site-blue-lt">✓</span>{f}</li>))}
              </ul>
              <Link href={t.cta.href} className={`mt-6 block rounded-lg px-5 py-3 text-center text-sm font-semibold transition-colors ${t.featured ? "bg-site-blue text-white hover:bg-site-blue-hi" : "border border-white/20 text-white hover:border-site-blue-lt hover:text-site-blue-lt"}`}>{t.cta.label}</Link>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-2xl text-center font-site-mono text-[11px] leading-5 text-white/45">{p.investorNote}</p>
      </section>

      {/* Side-by-side comparison */}
      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-site-display text-2xl font-extrabold tracking-tight text-site-navy sm:text-3xl">{p.comparison.title}</h2>
          <p className="mt-2 text-site-muted">{p.comparison.sub}</p>
          <div className="mt-8 overflow-hidden rounded-2xl border border-site-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-site-paper font-site-mono text-[11px] uppercase tracking-wide text-site-muted">
                <tr><th className="px-5 py-3"> </th><th className="px-5 py-3">{p.comparison.cols[0]}</th><th className="px-5 py-3">{p.comparison.cols[1]}</th></tr>
              </thead>
              <tbody>
                {p.comparison.rows.map((r) => (
                  <tr key={r.k} className="border-t border-site-line">
                    <td className="px-5 py-3 text-site-ink">{r.k}</td>
                    <td className="px-5 py-3 text-site-muted">{r.a}</td>
                    <td className="px-5 py-3 text-site-muted">{r.b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ (required Pricing → Readiness cross-link above it, §3) */}
      <section className="bg-site-paper px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <p className="font-site-mono text-xs font-semibold uppercase tracking-[0.16em] text-site-blue">{p.faq.eyebrow}</p>
          <h2 className="mt-3 font-site-display text-3xl font-extrabold tracking-tight text-site-navy">{p.faq.title}</h2>
          <p className="mt-4">
            <Link href={p.crossLink.href} className="inline-block rounded-lg border border-site-blue/30 bg-site-blue-pale/50 px-4 py-2.5 text-sm font-medium text-site-blue transition-colors hover:bg-site-blue-pale">{p.crossLink.label} →</Link>
          </p>
          <div className="mt-8 space-y-3">
            {p.faq.items.map((i) => (
              <details key={i.q} className="group rounded-xl border border-site-line bg-white px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between font-site-display text-base font-semibold text-site-navy">
                  {i.q}
                  <span className="ml-4 text-site-muted transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm leading-6 text-site-muted">{i.a}</p>
              </details>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <span className="text-sm text-site-muted">Prefer a walkthrough first?</span>
            <BookDemoButton variant="outline" />
          </div>
        </div>
      </section>
    </>
  );
}
