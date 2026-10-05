import { describe, expect, it } from "vitest";
import { applyFileGate, parseReviewJson, type SpotlightReview } from "./review";
import { checkSpotlightFile } from "./rules";

describe("parseReviewJson", () => {
  it("reads a well formed reply wrapped in prose", () => {
    const r = parseReviewJson(
      'Here: {"outline":{"hook":true,"solution":true,"traction":true,"market":true,"team":false,"ask":true},"endsWithAsk":true,"compliance":[{"quote":"guaranteed 3x","why":"promises returns"}],"recommendation":"request_change","summary":"Good pitch.","changeRequest":"Remove the return claim."}',
    );
    expect(r?.outline.team).toBe(false);
    expect(r?.outline.ask).toBe(true);
    expect(r?.compliance[0].quote).toBe("guaranteed 3x");
    expect(r?.recommendation).toBe("request_change");
  });
  it("returns null on garbage", () => {
    expect(parseReviewJson("no json here")).toBeNull();
  });
  it("defaults an unknown recommendation to request_change", () => {
    expect(parseReviewJson('{"recommendation":"ship it"}')?.recommendation).toBe("request_change");
  });
});

describe("applyFileGate", () => {
  const base = (ok: boolean): SpotlightReview => ({
    fileChecks: checkSpotlightFile({ type: "video/mp4", bytes: 10, seconds: ok ? 170 : 240, width: 1920, height: 1080 }),
    outline: { hook: true, solution: true, traction: true, market: true, team: true, ask: true },
    endsWithAsk: true,
    compliance: [],
    recommendation: "approve",
    summary: "",
    changeRequest: null,
    model: "ai",
  });
  it("keeps approve when every file check passes", () => {
    expect(applyFileGate(base(true)).recommendation).toBe("approve");
  });
  it("downgrades approve when the video is too long", () => {
    const r = applyFileGate(base(false));
    expect(r.recommendation).toBe("request_change");
    expect(r.changeRequest).toContain("3:00 or less");
  });
});
