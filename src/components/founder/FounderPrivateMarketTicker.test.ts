import { describe, expect, it } from "vitest";
import { tickerDurationSeconds } from "./FounderPrivateMarketTicker";

const row = { name: "Vladimir Gidirim", company: "Vladimir Gidirim", sectors: ["Artificial Intelligence"], matchScore: 70 };

describe("founder ticker speed", () => {
  it("grows with the number of investors so the speed stays the same", () => {
    const ten = tickerDurationSeconds(Array.from({ length: 10 }, () => row));
    const fifty = tickerDurationSeconds(Array.from({ length: 50 }, () => row));
    expect(fifty / ten).toBeCloseTo(5, 1);
  });

  it("runs about 60px a second (50 rows of about 380px take about 5 minutes a pass)", () => {
    expect(tickerDurationSeconds(Array.from({ length: 50 }, () => row))).toBe(315);
  });

  it("never loops faster than 20 seconds for a short list", () => {
    expect(tickerDurationSeconds([row])).toBe(20);
  });
});
