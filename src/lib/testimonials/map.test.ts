import { describe, expect, it } from "vitest";
import { rowToFounderResult, type TestimonialRow } from "./map";
import { crrBadge } from "@/content/founder-results";

const row: TestimonialRow = {
  id: "1", email: "a@b.co", name: "Alan Steinberg", title: "CEO", company_name: "Brainiest AI", industry: "AI", stage: "Seed",
  quote: "Great.", anonymous: false, show_score: true, crr_start: 28, crr_current: 76,
  consent_at: "2026-10-02T10:00:00Z", status: "approved", reviewed_at: "2026-10-03T09:00:00Z", created_at: "2026-10-02T10:00:00Z",
};

describe("rowToFounderResult", () => {
  it("maps a named entry with its score", () => {
    const r = rowToFounderResult(row);
    expect(r).toMatchObject({ name: "Alan Steinberg", title: "CEO", company: "Brainiest AI", approvedOn: "2026-10-03" });
    expect(crrBadge(r)).toBe("CRR 28 → 76");
  });
  it("hides identity for anonymous entries and the score when not allowed", () => {
    const r = rowToFounderResult({ ...row, anonymous: true, show_score: false });
    expect(r.name).toBeUndefined();
    expect(r.company).toBeUndefined();
    expect(crrBadge(r)).toBeNull();
    expect(r.stage).toBe("Seed");
  });
});
