import { describe, expect, it } from "vitest";
import { acceptQuotes, parseExtraction, verifyQuote } from "./quotes";

const thread = `[Oct 24] email (Dana): Before we commit, how long does this take and what is included? I'd rather not pay before I know it works.`;

describe("verifyQuote", () => {
  it("accepts text that is in the thread, ignoring case, spacing and curly quotes", () => {
    expect(verifyQuote("How long does this take", thread)).toBe(true);
    expect(verifyQuote("I’d rather not pay before I know it works.", thread)).toBe(true);
  });
  it("rejects invented text", () => {
    expect(verifyQuote("We will sign next week", thread)).toBe(false);
  });
  it("rejects empty and very short quotes", () => {
    expect(verifyQuote("", thread)).toBe(false);
    expect(verifyQuote(null, thread)).toBe(false);
    expect(verifyQuote("works", thread)).toBe(false);
  });
});

describe("parseExtraction", () => {
  it("reads JSON wrapped in prose or fences", () => {
    const raw = 'Here you go:\n```json\n{"asked":"how long does this take","concern":null}\n```';
    expect(parseExtraction(raw)).toEqual({ asked: "how long does this take", concern: null });
  });
  it("returns null for anything that is not JSON", () => {
    expect(parseExtraction("no data")).toBeNull();
    expect(parseExtraction("{broken")).toBeNull();
  });
});

describe("acceptQuotes", () => {
  it("drops a quote the thread does not contain and keeps the real one", () => {
    const out = acceptQuotes({ asked: "how long does this take", concern: "the price is far too high" }, thread);
    expect(out).toEqual({ asked: "how long does this take", concern: null });
  });
  it("handles a missing extraction", () => {
    expect(acceptQuotes(null, thread)).toEqual({ asked: null, concern: null });
  });
});
