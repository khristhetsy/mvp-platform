import type { Metadata } from "next";
import Link from "next/link";
import { pricingFor, pricingSummary } from "@/content/pricing";
import { loadPricing } from "@/lib/subscriptions/pricing-server";
import { JsonLd } from "@/components/seo/JsonLd";
import { BookDemoButton } from "@/components/marketing-site/BookDemoButton";
import { loadPriceAnchor } from "@/lib/marketing-site/price-anchor";

export async function generateMetadata(): Promise<Metadata> {
  const catalog = await loadPricing();
  return {
    title: "Pricing | iCapOS",
    description: `Start free with an AI due diligence report and a Private Market listing. Upgrade when investors are interested. ${pricingSummary(catalog)}`,
    alternates: { canonical: "/pricing" },
  };
}


export default async function PricingPage() {
  const catalog = await loadPricing();
  const p = pricingFor(catalog);
  // Four self-serve plans in the grid; the SPV Program (contact sales) sits below as its own band.
  const plans = p.tiers.filter((t) => !("contactSales" in t && t.contactSales));
  const spv = p.tiers.find((t) => "contactSales" in t && t.contactSales);
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: p.faq.items.map((i) => ({
      "@type": "Question",
      name: i.q,
      acceptedAnswer: { "@type": "Answer", text: i.a },
    })),
  };
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
          <Link href={p.mainCta.href} className="mt-7 inline-block rounded-lg bg-site-blue px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi">{p.mainCta.label}</Link>
          {/* Price anchor — the alternative cost of outreach (brief Step 5). Figures from data/price-anchor.json; omitted until populated; no competitor names. */}
          {anchor ? (
            <p className="mx-auto mt-6 max-w-2xl text-[13px] leading-6 text-white/55">
              For comparison, a dedicated Investor Relations retainer runs {anchor.ir_retainer}, a purchased investor list {anchor.list_purchase}, and a placement agent typically takes {anchor.placement_pct} of the round.
            </p>
          ) : null}
        </div>
        <div className={`mx-auto mt-10 grid gap-5 sm:grid-cols-2 ${plans.length > 3 ? "max-w-6xl xl:grid-cols-4" : "max-w-5xl xl:grid-cols-3"}`}>
          {plans.map((t) => (
            <div key={t.name} className={`relative rounded-2xl p-6 ${t.featured ? "border-2 border-site-blue-lt bg-white/[0.07] ring-1 ring-site-blue-lt/25" : "border border-white/12 bg-white/[0.03]"}`}>
              {/* Professional primacy tag; Professional is order-first on mobile (brief Step 6). */}
              {t.featured ? (
                <div className="absolute -top-3 left-6 rounded-full bg-site-blue px-3 py-1 font-site-mono text-[10px] font-semibold uppercase tracking-wider text-white">Most founders start here</div>
              ) : null}
              <div className="flex items-center justify-between">
                <h2 className="font-site-display text-xl font-bold">{t.name}</h2>
                {"badge" in t && t.badge ? <span className="rounded-full bg-site-blue/25 px-2.5 py-0.5 font-site-mono text-[10px] font-medium text-site-blue-lt">{t.badge}</span> : null}
              </div>
              <div className="mt-3 flex items-baseline gap-1"><span className={`font-site-display font-extrabold ${t.per ? "text-4xl" : "text-2xl"}`}>{t.price}</span>{t.per ? <span className="text-sm text-white/50">{t.per}</span> : null}</div>
              <p className="mt-2 text-sm text-white/65">{t.desc}</p>
              {"features" in t && t.features ? (
                <ul className="mt-5 space-y-2.5">
                  {t.features.map((f) => (<li key={f} className="flex gap-2.5 text-[13.5px] text-white/85"><span className="text-site-blue-lt"><i className="ti ti-check" aria-hidden="true" /></span>{f}</li>))}
                </ul>
              ) : null}
              {"advisory" in t && t.advisory ? (
                <div className="mt-5 rounded-xl border border-site-blue-lt/30 bg-site-blue/[0.07] p-4">
                  <div className="flex items-center gap-2 text-site-blue-lt"><i className="ti ti-building-bank" aria-hidden="true" /><span className="font-site-mono text-[10px] uppercase tracking-wider">{t.advisory.brand}</span></div>
                  <p className="mt-2 text-[15px] font-semibold text-white">{t.advisory.title}</p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-white/70">{t.advisory.body}</p>
                </div>
              ) : null}
              <Link href={t.cta.href} {...("contactSales" in t && t.contactSales ? { target: "_blank", rel: "noopener noreferrer" } : {})} className={`mt-6 block rounded-lg px-5 py-3 text-center text-sm font-semibold transition-colors ${t.featured ? "bg-site-blue text-white hover:bg-site-blue-hi" : "border border-white/20 text-white hover:border-site-blue-lt hover:text-site-blue-lt"}`}>{t.cta.label}</Link>
            </div>
          ))}
        </div>
        {spv ? (
          <div className="mx-auto mt-5 grid max-w-6xl gap-5 rounded-2xl border border-white/12 bg-white/[0.03] p-6 md:grid-cols-[1fr_1.2fr_auto] md:items-center">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="font-site-display text-xl font-bold">{spv.name}</h2>
                {"badge" in spv && spv.badge ? <span className="rounded-full bg-site-blue/25 px-2.5 py-0.5 font-site-mono text-[10px] font-medium text-site-blue-lt">{spv.badge}</span> : null}
              </div>
              <div className="mt-2 font-site-display text-2xl font-extrabold">{spv.price}</div>
              <p className="mt-1 text-sm text-white/65">{spv.desc}</p>
            </div>
            {"advisory" in spv && spv.advisory ? (
              <div className="rounded-xl border border-site-blue-lt/30 bg-site-blue/[0.07] p-4">
                <div className="flex items-center gap-2 text-site-blue-lt"><i className="ti ti-building-bank" aria-hidden="true" /><span className="font-site-mono text-[10px] uppercase tracking-wider">{spv.advisory.brand}</span></div>
                <p className="mt-2 text-[15px] font-semibold text-white">{spv.advisory.title}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-white/70">{spv.advisory.body}</p>
              </div>
            ) : <div />}
            <Link href={spv.cta.href} target="_blank" rel="noopener noreferrer" className="block rounded-lg border border-white/20 px-5 py-3 text-center text-sm font-semibold text-white transition-colors hover:border-site-blue-lt hover:text-site-blue-lt">{spv.cta.label}</Link>
          </div>
        ) : null}
        <p className="mx-auto mt-8 max-w-2xl text-center font-site-mono text-[11px] leading-5 text-white/45">
          Investors join free at <Link href={p.investorLink.href} className="text-site-blue-lt hover:underline">{p.investorLink.label}</Link>. Investors are never charged, and iCapOS takes no fee from either side of an introduction.
        </p>
        {/* Non-refundable policy, framed on services-rendered-immediately (§13). Binding terms live in /terms (counsel). */}
        <p className="mx-auto mt-4 max-w-3xl text-center font-site-mono text-[11px] leading-5 text-white/45">{p.billingNote}</p>
        <p className="mx-auto mt-4 max-w-3xl text-center font-site-mono text-[11px] leading-5 text-white/60">{p.disclaimer}</p>
      </section>

      {/* Side-by-side comparison */}
      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-site-display text-2xl font-extrabold tracking-tight text-site-navy sm:text-3xl">{p.comparison.title}</h2>
          <p className="mt-2 text-site-muted">{p.comparison.sub}</p>
          <div className="mt-8 overflow-x-auto rounded-2xl border border-site-line">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-site-paper font-site-mono text-[11px] uppercase tracking-wide text-site-muted">
                <tr><th className="px-5 py-3"> </th>{p.comparison.cols.map((c) => (<th key={c} className="px-5 py-3">{c}</th>))}</tr>
              </thead>
              <tbody>
                {p.comparison.rows.map((r) => (
                  <tr key={r.k} className="border-t border-site-line">
                    <td className="px-5 py-3 text-site-ink">{r.k}</td>
                    {r.vals.map((v, i) => (<td key={i} className="px-5 py-3 text-site-muted">{v}</td>))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-site-muted">{p.comparison.note}</p>
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
            <Link href={p.mainCta.href} className="rounded-lg bg-site-blue px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi">{p.mainCta.label}</Link>
            <span className="text-sm text-site-muted">Prefer a walkthrough first?</span>
            <BookDemoButton variant="outline" />
          </div>
          <p className="mt-8 text-xs leading-5 text-site-muted">{p.disclaimer} Content is for educational purposes only.</p>
        </div>
      </section>
    </>
  );
}
