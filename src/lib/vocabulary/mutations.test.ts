/**
 * The rules that keep an edit from orphaning an answer.
 */
import { describe, it, expect } from "vitest";
import { checkAdd, checkRename, deriveSlug } from "@/lib/vocabulary/mutations";
import type { VocabularyOption } from "@/lib/vocabulary/lists";

const list: VocabularyOption[] = [
  { slug: "fintech", label: "Fintech", archived: false },
  { slug: "saas", label: "SaaS", archived: false },
  { slug: "healthtech", label: "HealthTech", archived: true },
];

describe("deriving a key", () => {
  it("lowercases and hyphenates", () => {
    expect(deriveSlug("Quantum Computing")).toBe("quantum-computing");
  });

  it("spells out an ampersand rather than dropping the word join", () => {
    expect(deriveSlug("Oil & Gas")).toBe("oil-and-gas");
    expect(deriveSlug("Health & Wellness")).toBe("health-and-wellness");
  });

  it("collapses punctuation", () => {
    expect(deriveSlug("Biotechnology/Life Science")).toBe("biotechnology-life-science");
    expect(deriveSlug("  AI / ML  ")).toBe("ai-ml");
  });

  it("never leaves a leading or trailing hyphen", () => {
    expect(deriveSlug("— Other —")).toBe("other");
  });
});

describe("adding a value", () => {
  it("accepts a new one", () => {
    expect(checkAdd(list, "Quantum Computing")).toEqual({ ok: true, slug: "quantum-computing" });
  });

  it("refuses a name that would collide with an existing key", () => {
    const r = checkAdd(list, "FinTech");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("Fintech");
  });

  // Reviving a retired value and creating a new one are different intentions.
  // Guessing between them is how a retired answer quietly becomes a live one.
  it("refuses a collision with an archived key, and says to restore instead", () => {
    const r = checkAdd(list, "HealthTech");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("Restore");
  });

  it("refuses a name with nothing in it", () => {
    expect(checkAdd(list, " ").ok).toBe(false);
    expect(checkAdd(list, "—").ok).toBe(false);
  });
});

describe("renaming", () => {
  it("accepts a reword", () => {
    expect(checkRename(list, "fintech", "Financial Technology")).toEqual({ ok: true });
  });

  it("refuses two options that would read identically", () => {
    const r = checkRename(list, "fintech", "SaaS");
    expect(r.ok).toBe(false);
  });

  it("refuses an option that is not there", () => {
    expect(checkRename(list, "web3", "Web3").ok).toBe(false);
  });

  it("lets an option keep its own label", () => {
    expect(checkRename(list, "fintech", "Fintech")).toEqual({ ok: true });
  });
});
