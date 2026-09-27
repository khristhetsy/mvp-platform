import { describe, it, expect } from "vitest";
import { applyRoleFilter, type ReportPayload } from "./serialize";
import { DEFAULT_GATE } from "./gate";
import type { GateMap } from "./gate";
import { buildReportModel, emptyReportPayload, type CompanySnapshot, type ReportExtras } from "./report-model";
import { renderDiligenceMemoPdf } from "./pdf";

const SECRET = "SECRET-ANALYST-NOTE";
const REVIEW = "needs_more";

function fullPayload(): ReportPayload {
  return {
    engagement: { id: "e1", company_name: "KoreInside", report_code: "DD-KOR-2609", lifecycle_stage: "sent_to_founder", posture: "Constructive", recommendation: "Proceed with conditions", owner_id: "u1", confidence_pct: 64, company_id: "c1" },
    domains: [{ id: "d1", code: "D-01", name: "Financial", risk_rating: "high", conclusion: "Revenue not tied to bank statements." }],
    findings: [
      { id: "f1", finding_code: "F-01", domain_id: "d1", title: "Deck revenue differs from P&L", severity: "high", status: "open", verification: "discrepancy", internal_note: SECRET, detail: "Deck p.12 vs FY25 P&L." },
      { id: "f2", finding_code: "F-02", domain_id: "d1", title: "IP assignments", severity: "low", status: "resolved", verification: "verified" },
    ],
    claims: [{ id: "c1", claim: "ARR CLAIM-TEXT", claimed_value: "$1M", verification: "discrepancy", weight: 3, finding_id: "f1" }],
    responses: [{ id: "r1", finding_codes: ["F-01"], body: "Restated deck attached.", disposition: "remediating", icfo_review: REVIEW, owner_role: "founder" }],
    docRequests: [{ id: "dr1", category: "financial", label: "Bank statements", status: "requested", closes_findings: ["F-01"] }],
    conditions: [{ id: "k1", label: "High findings resolved", status: "in_progress" }],
    confidence: 64,
  };
}

const snapshot: CompanySnapshot = {
  company_name: "KoreInside", latest_readiness_score: null, risk_score: 4, document_count: 10, pitch_deck_present: true, documents_approved_count: 0,
  remediation_open: 8, remediation_completed: 13, remediation_high_priority_open: 3, open_compliance_events: 0, flagged_outreach_social_message_indicators: 0,
  expressed_interest_count: 0, indicative_pledge_total: 0, intro_request_count: 0, message_thread_count: 0, meetings_scheduled_count: 0, learning_modules_completed: 0,
};

const staffExtras: ReportExtras = {
  snapshot,
  audit: [{ at: "2026-09-26T10:09:00Z", actor: "AUDIT-ACTOR", action: "report_generated", target: null }],
  gate: { findings: { founder: true, investor: true } },
  generatedBy: "Khris Thetsy",
  generatedAt: new Date("2026-09-26T10:09:00Z"),
};

const gate: GateMap = Object.fromEntries(Object.entries(DEFAULT_GATE).map(([k, v]) => [k, v]));
const keys = (m: ReturnType<typeof buildReportModel>) => m.sections.map((s) => s.key);

describe("buildReportModel", () => {
  it("gives staff every section, including internal ones", () => {
    const m = buildReportModel(fullPayload(), "admin", staffExtras);
    expect(keys(m)).toEqual(["domains", "findings", "claims", "dataroom", "remediation", "responses", "conditions", "investor", "visibility", "seal", "audit", "method"]);
    expect(m.readiness).toEqual({ score: null });
    expect(m.metrics.map((x) => x.value)).toEqual(["10", "13/21", "3", "0", "0"]);
    expect(m.takeaways[0].title).toBe("Readiness is unscored.");
  });

  it("founder copy drops staff sections and extras even if the caller passes them", () => {
    const founderPayload = applyRoleFilter(fullPayload(), "founder", gate);
    const m = buildReportModel(founderPayload, "founder", staffExtras);
    expect(keys(m)).toEqual(["domains", "findings", "dataroom", "responses", "conditions", "seal", "method"]);
    expect(m.readiness).toBeNull();
    expect(m.riskLevel).toBeNull();
    expect(m.generatedBy).toBeNull();
    expect(m.verdict.released).toBe(false);
    expect(m.verdict.placeholder).toBe("Not released to this recipient");
    const json = JSON.stringify(m);
    for (const leak of [SECRET, REVIEW, "CLAIM-TEXT", "AUDIT-ACTOR", "Needs more", "Risk level"]) expect(json).not.toContain(leak);
  });

  it("investor copy shows the verdict but not the data room by default", () => {
    const m = buildReportModel(applyRoleFilter(fullPayload(), "investor", gate), "investor", {});
    expect(m.verdict.recommendation).toBe("Proceed with conditions");
    expect(keys(m)).not.toContain("dataroom");
  });

  it("keeps domain counts in step with the findings register", () => {
    const m = buildReportModel(fullPayload(), "admin", staffExtras);
    const row = m.sections.find((s) => s.key === "domains")!.table!.rows[0];
    expect(row.slice(2, 4)).toEqual(["2", "1"]);
  });

  it("says so when a company has no engagement", () => {
    const m = buildReportModel(emptyReportPayload("Acme"), "admin", { snapshot, noEngagement: true });
    expect(m.verdict.placeholder).toBe("No diligence engagement opened");
    expect(m.takeaways[0].title).toBe("No diligence engagement opened.");
  });
});

async function pdfText(buf: Buffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  let out = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const c = await page.getTextContent();
    out += c.items.map((it) => ("str" in it ? it.str : "")).join(" ") + "\n";
  }
  return out;
}

describe("renderDiligenceMemoPdf", () => {
  it("renders the staff report", async () => {
    const buf = await renderDiligenceMemoPdf(fullPayload(), "admin", staffExtras);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
    const text = await pdfText(buf);
    expect(text).toContain("Due Diligence Report");
    expect(text).toContain(SECRET);
    expect(text).toContain("Claim verification");
  });

  it("founder PDF contains no internal content", async () => {
    const buf = await renderDiligenceMemoPdf(applyRoleFilter(fullPayload(), "founder", gate), "founder", staffExtras);
    const text = await pdfText(buf);
    expect(text).toContain("Founder copy");
    expect(text).toContain("F-01");
    for (const leak of [SECRET, "CLAIM-TEXT", "AUDIT-ACTOR", "Proceed with conditions", "Needs more", "Not scored", "Risk level"]) expect(text).not.toContain(leak);
  });

  it("paginates long registers without losing rows", async () => {
    const p = fullPayload();
    p.findings = Array.from({ length: 80 }, (_, i) => ({ id: `f${i}`, finding_code: `F-${String(i).padStart(2, "0")}`, title: `Finding ${i} with a reasonably long title to wrap`, severity: "medium", status: "open", verification: "requested" }));
    const text = await pdfText(await renderDiligenceMemoPdf(p, "admin", staffExtras));
    expect(text).toContain("F-00");
    expect(text).toContain("F-79");
  });
});
