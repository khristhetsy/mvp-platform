import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ComplianceNotice } from "@/components/ComplianceNotice";
import { deals } from "@/lib/mock-data";

export default async function DealDetailPage({
  params,
}: Readonly<{
  params: Promise<{ slug: string }>;
}>) {
  const { slug } = await params;
  const deal = deals.find((item) => item.slug === slug);

  if (!deal) {
    notFound();
  }

  const sections = [
    ["Company overview", deal.overview],
    ["Problem", deal.problem],
    ["Solution", deal.solution],
    ["Market opportunity", deal.marketOpportunity],
    ["Traction", deal.traction],
    ["Team", deal.team],
    ["Use of funds", deal.useOfFunds],
    ["AI diligence summary", deal.diligenceSummary],
    ["Risk disclosures", deal.riskDisclosures],
  ];

  return (
    <AppShell role="INVESTOR">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">{deal.industry}</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">{deal.companyName}</h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">{deal.shortSummary}</p>
            <p className="mt-3 text-sm text-slate-500">
              {deal.stage} · {deal.location}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-950 p-6 text-white lg:min-w-72">
            <p className="text-sm text-slate-300">Readiness score</p>
            <p className="mt-2 text-5xl font-semibold">{deal.readinessScore}</p>
            <p className="mt-2 text-sm text-slate-300">AI-assisted, admin-reviewed</p>
          </div>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-5">
            <p className="text-sm text-slate-500">Funding target</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{deal.fundingTarget}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-5">
            <p className="text-sm text-slate-500">Minimum investment</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{deal.minimumInvestment}</p>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.42fr]">
        <div className="grid gap-4">
          {sections.map(([title, body]) => (
            <article key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="font-semibold text-slate-950">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{body}</p>
            </article>
          ))}
        </div>
        <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Investor actions</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Expressing interest or requesting an intro does not create an investment commitment, allocation, or guarantee
            of returns.
          </p>
          <form action="/api/investor/interests" method="post" className="mt-5 grid gap-4">
            <input type="hidden" name="campaignId" value={deal.slug} />
            <input
              name="interestAmount"
              className="rounded-2xl border border-slate-300 px-4 py-3 text-sm"
              placeholder="Indicative interest amount"
            />
            <textarea
              name="message"
              rows={5}
              className="rounded-2xl border border-slate-300 p-4 text-sm"
              placeholder="Optional note for the issuer or platform team"
            />
            <button type="submit" className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white">
              Express interest
            </button>
            <button
              type="submit"
              name="requestedCall"
              value="true"
              className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800"
            >
              Request intro
            </button>
          </form>
        </aside>
      </section>

      <div className="mt-8">
        <ComplianceNotice />
      </div>
    </AppShell>
  );
}
