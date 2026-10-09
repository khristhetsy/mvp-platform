import type { Metadata } from "next";
import { IcapOSLogo } from "@/components/IcapOSLogo";
import { DiligenceReportDocument } from "@/components/founder/DiligenceReportDocument";
import { loadSharedReport, recordShareView } from "@/lib/reports/report-shares";
import { PLATFORM_TZ } from "@/lib/time/platform-tz";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Due diligence report · iCapOS",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

const DISCLAIMER =
  "iCFO Capital does not solicit securities and is not an investment adviser. Content is for educational purposes only.";

function splitLines(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  return value.split(/\n+/).map((l) => l.trim()).filter(Boolean);
}

function Shell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="min-h-screen bg-[#F6F8FC] text-[#16223F]">
      <header className="border-b border-slate-200 bg-white" style={{ borderTop: "4px solid #0A1A40" }}>
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <IcapOSLogo height={30} priority />
          <span className="text-xs text-slate-500">Shared securely by the company</span>
        </div>
      </header>
      <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6">{children}</div>
      <footer className="mx-auto max-w-[1100px] px-4 pb-10 sm:px-6">
        <p className="border-t border-slate-200 pt-4 text-[11px] leading-5 text-slate-500">{DISCLAIMER}</p>
      </footer>
    </main>
  );
}

/**
 * Public, read only view of a founder's latest AI diligence report, reached by
 * a secure share link. No sign in. Every open is counted for the founder.
 * Unknown and turned off links show one friendly page, so a link never reveals
 * whether it ever existed.
 */
export default async function SharedReportPage({ params }: Readonly<{ params: Promise<{ token: string }> }>) {
  const { token } = await params;
  const shared = await loadSharedReport(token);

  if (!shared) {
    return (
      <Shell>
        <section className="mx-auto mt-10 max-w-lg rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-[#0A1A40]">This link is no longer active</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            The company that shared this report has turned the link off, or the address is incomplete. Ask them for a new link.
          </p>
        </section>
      </Shell>
    );
  }

  await recordShareView(shared.shareId, "view");
  const { report, companyName } = shared;
  const generatedAt = new Date(report.created_at).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: PLATFORM_TZ,
  });

  return (
    <Shell>
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1A6CE4]">AI due diligence report</p>
            <h1 className="mt-1 text-2xl font-semibold text-[#0A1A40]">{companyName}</h1>
            <p className="mt-1 text-xs text-slate-500">Generated {generatedAt} (PT). Read only.</p>
          </div>
          <div className="flex items-center gap-3">
            {typeof report.readiness_score === "number" ? (
              <div className="rounded-lg bg-[#0A1A40] px-4 py-2 text-white">
                <p className="text-[11px] text-slate-300">Readiness score in this report</p>
                <p className="text-2xl font-semibold tabular-nums">{report.readiness_score}</p>
              </div>
            ) : null}
            <a
              href={`/api/share/report/${encodeURIComponent(token)}/pdf`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1A6CE4] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#2E78F5]"
            >
              <i className="ti ti-download" aria-hidden="true" /> Download PDF
            </a>
          </div>
        </div>
      </section>

      <DiligenceReportDocument
        companyName={companyName}
        generatedAt={generatedAt}
        executiveSummary={report.executive_summary}
        businessOverview={report.business_overview}
        financialReview={report.financial_review}
        marketReview={report.market_review}
        legalReview={report.legal_review}
        teamReview={report.team_review}
        missingDocuments={(report.missing_documents ?? []) as string[]}
        recommendations={splitLines(report.recommendations)}
        riskFlags={(report.risk_flags ?? []) as string[]}
      />
    </Shell>
  );
}
