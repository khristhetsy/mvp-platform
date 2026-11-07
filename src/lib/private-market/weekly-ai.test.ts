import { describe, expect, it } from "vitest";
import { allowedFigures, checkOption, cleanDashes, factOptions, numbersIn, parseOptions, rewriteTask, writeTask } from "./weekly-ai";
import type { DigestMarket } from "./weekly-digest";

const market: DigestMarket = {
  range: "30 Oct to 6 Nov 2026", asOfLabel: "6 Nov 2026", avgCrr: 58,
  tiles: [{ label: "AVG CRR", value: "58.0", change: 7, delta: "+7.00 · +13.7%" }, { label: "FOUNDERS SCORED", value: "22", change: 3, delta: "+3 · +15.8%" }],
  gainers: [{ symbol: "OPHTHA", crr: 90, change: 89, pct: 8900 }],
  sectors: [{ sector: "AI / ML", avg: 96.5, scored: 2 }],
  approvedTotal: 35, newlyApproved: { count: 10, scored: 2 },
  moves: [{ symbol: "OPHTHA", from: 3, to: 90 }, { symbol: "FIRST", from: null, to: 91 }],
};

describe("factOptions", () => {
  const f = factOptions(market, "founder");
  it("builds every fact from the real numbers", () => {
    expect(f.map((x) => x.key)).toEqual(["approved", "moves", "market", "gainer", "sector", "recipient"]);
    expect(f[0].text).toContain("10 companies were approved");
    expect(f[0].text).toContain("35 are approved in total");
    expect(f[1].text).toBe("Rating moves this week: OPHTHA moved from 3 to 90, FIRST newly rated 91.");
    expect(f[2].text).toContain("avg crr 58.0 (+7.00 · +13.7%)");
    expect(f[3].text).toContain("OPHTHA, up 89 points");
    expect(f[4].text).toContain("AI / ML at 96.5");
  });
  it("starts with the approved, moves and market facts ticked", () => {
    expect(f.filter((x) => x.defaultOn).map((x) => x.key)).toEqual(["approved", "moves", "market"]);
  });
  it("skips facts that have no data", () => {
    const keys = factOptions({ ...market, moves: [], gainers: [], sectors: [] }, "investor").map((x) => x.key);
    expect(keys).toEqual(["approved", "market", "recipient"]);
  });
  it("tells the writer to use merge fields instead of the recipient's numbers", () => {
    expect(f[5].text).toContain("{rating}");
    expect(factOptions(market, "investor").at(-1)?.text).toContain("{approved}");
  });
});

describe("figures", () => {
  it("reads numbers with commas and decimals", () => {
    expect([...numbersIn("1,640.0% and 58.0 and 22")].sort()).toEqual(["1640", "1640.0", "22", "58", "58.0"]);
  });
  const facts = factOptions(market, "founder").filter((x) => ["approved", "moves"].includes(x.key));
  const allowed = allowedFigures(facts, "mention the event on 20 Nov");
  it("accepts figures from the ticked facts and the extra line", () => {
    expect(checkOption("10 companies approved and OPHTHA moved from 3 to 90", allowed, 100).ok).toBe(true);
    expect(checkOption("Join us on 20 Nov", allowed, 100).ok).toBe(true);
  });
  it("drops an option with a figure that is not in the facts", () => {
    const r = checkOption("Average rating is 61.2 this week", allowed, 100);
    expect(r).toEqual({ ok: false, reason: "figure 61.2 is not in the facts" });
  });
  it("does not count a figure from an unticked fact", () => {
    expect(checkOption("The average rating is 58.0", allowed, 100).ok).toBe(false);
  });
});

describe("checkOption", () => {
  const allowed = new Set<string>();
  it("keeps the three merge fields and rejects other placeholders", () => {
    expect(checkOption("Your rating is {rating} ({band})", allowed, 100).ok).toBe(true);
    expect(checkOption("Hello {name}", allowed, 100)).toEqual({ ok: false, reason: "unknown field {name}" });
  });
  it("enforces the length and strips wrapping quotes", () => {
    expect(checkOption("x".repeat(101), allowed, 100)).toEqual({ ok: false, reason: "too long" });
    expect(checkOption('"A quiet week"', allowed, 100)).toEqual({ ok: true, text: "A quiet week" });
  });
  it("requires a rewrite to keep its merge fields", () => {
    expect(checkOption("Your rating is here", allowed, 100, ["{rating}"])).toEqual({ ok: false, reason: "lost {rating}" });
  });
  it("removes dashes used as punctuation", () => {
    expect(cleanDashes("Big week — see why - now")).toBe("Big week, see why, now");
    expect(checkOption("Big week — see why", allowed, 100)).toEqual({ ok: true, text: "Big week, see why" });
  });
});

describe("parseOptions", () => {
  it("reads plain and fenced json", () => {
    expect(parseOptions('{"options":["a","b","c"]}')).toEqual(["a", "b", "c"]);
    expect(parseOptions('```json\n{"options":["a"]}\n```')).toEqual(["a"]);
  });
  it("returns nothing for text that is not json", () => {
    expect(parseOptions("Sure! Here you go")).toEqual([]);
    expect(parseOptions('{"options":"nope"}')).toEqual([]);
  });
});

describe("prompts", () => {
  const facts = factOptions(market, "founder").slice(0, 2);
  it("lists only the ticked facts and asks for json", () => {
    const t = writeTask({ target: "subject", tone: "formal", facts, extra: "", audience: "founder" });
    expect(t).toContain("- 10 companies were approved");
    expect(t).not.toContain("average");
    expect(t).toContain("100 characters or fewer");
    expect(t).toContain('{"options"');
  });
  it("includes the admin's extra line", () => {
    expect(writeTask({ target: "note", tone: "friendly", facts, extra: "mention the event on 20 Nov", audience: "investor" })).toContain("mention the event on 20 Nov");
  });
  it("rewrite asks to keep placeholders and figures", () => {
    expect(rewriteTask({ action: "shorten", text: "Hello {rating}" })).toContain("exactly as written");
  });
});
