import { describe, expect, it } from "vitest";
import { validateTestimonial } from "./validate";

const base = { token: "t.x", quote: "iCapOS showed us exactly what to fix before investors saw it.", anonymous: false, showScore: true, consent: true };

describe("validateTestimonial", () => {
  it("accepts a valid submission and tidies whitespace", () => {
    const r = validateTestimonial({ ...base, quote: `  ${base.quote}\n\n `, title: " CEO " });
    expect(r.ok && r.value.quote).toBe(base.quote);
    expect(r.ok && r.value.title).toBe("CEO");
  });
  it("requires consent, a long enough quote and a token", () => {
    const r = validateTestimonial({ ...base, consent: false, quote: "short", token: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["consent", "quote", "token"]);
  });
  it("caps quote and title length", () => {
    const r = validateTestimonial({ ...base, quote: "x".repeat(601), title: "y".repeat(81) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["quote", "title"]);
  });
  it("defaults showScore on and anonymous off", () => {
    const r = validateTestimonial({ token: "t", quote: base.quote, consent: true });
    expect(r.ok && r.value.showScore).toBe(true);
    expect(r.ok && r.value.anonymous).toBe(false);
  });
});
