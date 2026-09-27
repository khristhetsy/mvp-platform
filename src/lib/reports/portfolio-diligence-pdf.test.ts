import { describe, it, expect } from "vitest";
import type { AdminReportPayload } from "./admin-reports";
import { PORTFOLIO_TABLE_LIMIT, buildDueDiligencePortfolioPdf, buildPortfolioModel } from "./portfolio-diligence-pdf";

function company(i: number, over: Record<string, unknown> = {}) {
  return {
    company_id: `c${i}`, company_name: `Company ${i}`, latest_readiness_score: 60 + i, onboarding_progress_percent: 80, document_count: 5, pitch_deck_present: true,
    documents_approved_count: 1, missing_required_documents: "", remediation_open: 2, remediation_completed: 4, remediation_high_priority_open: 0,
    open_compliance_events: 0, flagged_outreach_social_message_indicators: 0, expressed_interest_count: 1, indicative_pledge_total: 25000,
    intro_request_count: 0, message_thread_count: 1, meetings_scheduled_count: 0, learning_modules_completed: 2, risk_score: i, ...over,
  };
}

function payload(companies: Record<string, unknown>[], avg: number | null): AdminReportPayload {
  return {
    meta: { reportType: "due_diligence", generatedAt: "2026-09-27T10:00:00Z", preview: false, filters: {}, privacyNotice: "Internal staff report." },
    summary: { companiesIncluded: companies.length, averageReadinessScore: avg },
    sections: {
      company_diligence: companies,
      top_risk_companies: [...companies].sort((a, b) => Number(b.risk_score) - Number(a.risk_score)).slice(0, 10),
      readiness_distribution: [
        { bucket: "0-49", count: 0 }, { bucket: "50-69", count: companies.filter((c) => c.latest_readiness_score != null && Number(c.latest_readiness_score) < 70).length },
        { bucket: "70-89", count: companies.filter((c) => Number(c.latest_readiness_score) >= 70).length }, { bucket: "90+", count: 0 },
        { bucket: "unknown", count: companies.filter((c) => c.latest_readiness_score == null).length },
      ],
    },
  };
}

describe("buildPortfolioModel", () => {
  it("sums metrics from stored values", () => {
    const m = buildPortfolioModel(payload([company(1), company(2, { latest_readiness_score: null, open_compliance_events: 2, remediation_high_priority_open: 3 })], 61), "Staff");
    expect(m.metrics.map((x) => x.value)).toEqual(["2", "61", "1", "1", "2"]);
    expect(m.takeaways.map((t) => t.title)).toEqual(["1 of 2 companies are not yet scored.", "3 high priority remediation tasks open.", "1 company with open compliance events."]);
    const table = m.sections.find((s) => s.key === "companies")!.table!;
    expect(table.rows[0][0]).toBe("Company 2"); // compliance issues first
  });

  it("caps the company table and says so", () => {
    const many = Array.from({ length: PORTFOLIO_TABLE_LIMIT + 5 }, (_, i) => company(i));
    const s = buildPortfolioModel(payload(many, 70), "Staff").sections.find((x) => x.key === "companies")!;
    expect(s.table!.rows).toHaveLength(PORTFOLIO_TABLE_LIMIT);
    expect(s.intro).toContain(`${PORTFOLIO_TABLE_LIMIT} of ${PORTFOLIO_TABLE_LIMIT + 5}`);
  });

  it("handles an empty portfolio", () => {
    const m = buildPortfolioModel(payload([], null), "Staff");
    expect(m.metrics[1].value).toBe("—");
    expect(m.takeaways[0].title).toBe("No companies match these filters.");
  });
});

describe("buildDueDiligencePortfolioPdf", () => {
  it("renders a PDF", async () => {
    const buf = await buildDueDiligencePortfolioPdf(payload([company(1), company(2)], 62), { generatedBy: "Staff" });
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });
});
