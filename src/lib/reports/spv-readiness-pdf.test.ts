import { describe, it, expect } from "vitest";
import type { AdminReportPayload } from "./admin-reports";
import { SPV_TABLE_LIMIT, buildSpvModel, buildSpvReadinessV2Pdf } from "./spv-readiness-pdf";

function spv(i: number, over: Record<string, unknown> = {}) {
  return {
    spv_id: `s${i}`, spv_name: `SPV ${i}`, company_name: `Company ${i}`, spv_status: "open", target_amount: 500000, indicative_participation_total: 250000, investor_count: 5,
    checklist_readiness_pct: 80, investor_requirement_readiness_pct: 60, document_package_readiness_pct: 50, closing_readiness_pct: 55, closing_review_status: "not_started",
    pending_blockers: "None", pending_blocker_count: 0, compliance_events_count: 0, open_critical_compliance_count: 0, investors_document_ready_count: 2, investor_pending_requirements_count: 1, ...over,
  };
}

function payload(rows: Record<string, unknown>[]): AdminReportPayload {
  return {
    meta: { reportType: "spv_readiness", generatedAt: "2026-09-28T08:00:00Z", preview: false, filters: {}, privacyNotice: "Internal staff report." },
    summary: { spvsIncluded: rows.length, averageClosingReadinessPct: 55 },
    sections: { spv_readiness_rows: rows, notification_type_totals: [{ notification_type: "spv_investor_invited", count: 4 }] },
  };
}

describe("buildSpvModel", () => {
  it("derives metrics, pipeline and takeaways from stored values", () => {
    const m = buildSpvModel(payload([
      spv(1, { pending_blockers: "Checklist incomplete; KYC pending", pending_blocker_count: 2, open_critical_compliance_count: 1 }),
      spv(2, { closing_review_status: "approved_for_closing" }),
      spv(3, { spv_status: "closed", closing_review_status: "closed_operationally" }),
      spv(4, { closing_review_status: "in_review" }),
    ]), "Staff");
    expect(m.metrics.map((x) => x.value)).toEqual(["4", "$1,000,000", "20", "55%", "1"]);
    expect(m.pipeline.segments.map((s) => s.value)).toEqual([1, 1, 1, 1]);
    expect(m.takeaways.map((t) => t.title)).toEqual([
      "1 SPV with open closing blockers.",
      "1 SPV with open critical compliance events.",
      "Indicative participation covers 50% of combined targets.",
    ]);
    const blockers = m.sections.find((s) => s.key === "blockers")!.table!.rows;
    expect(blockers).toHaveLength(1);
    expect(blockers[0][3]).toBe("Checklist incomplete\nKYC pending");
  });

  it("caps the readiness table and says so", () => {
    const rows = Array.from({ length: SPV_TABLE_LIMIT + 3 }, (_, i) => spv(i));
    const s = buildSpvModel(payload(rows), "Staff").sections.find((x) => x.key === "readiness")!;
    expect(s.table!.rows).toHaveLength(SPV_TABLE_LIMIT);
    expect(s.intro).toContain(`${SPV_TABLE_LIMIT} of ${SPV_TABLE_LIMIT + 3}`);
  });

  it("handles no SPVs", () => {
    const m = buildSpvModel(payload([]), "Staff");
    expect(m.metrics[3].value).toBe("—");
    expect(m.takeaways[0].title).toBe("No SPVs match these filters.");
  });
});

describe("buildSpvReadinessV2Pdf", () => {
  it("renders a PDF", async () => {
    const buf = await buildSpvReadinessV2Pdf(payload([spv(1)]), { generatedBy: "Staff" });
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });
});
