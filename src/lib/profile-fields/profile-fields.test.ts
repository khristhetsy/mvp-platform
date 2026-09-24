/**
 * Profile and fields: the lists, the save rules, and the Where used map.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { CODE_FALLBACK } from "@/lib/vocabulary/lists";
import {
  ARR_BAND_OPTIONS, MRR_BAND_OPTIONS, MONEY_BAND_OPTIONS, REVENUE_SIZE_OPTIONS, REVENUE_STAGE_OPTIONS,
} from "@/lib/profile/options";
import { applyDefault, checkSave, countChanges, defaultOne, fromCsv, newSlug, toCsv, type DraftOption } from "@/lib/profile-fields/draft";
import { FIELD_SECTIONS, FIELD_USAGE, LIST_CONSTANTS } from "@/lib/profile-fields/catalog";

const slugs = (l: keyof typeof CODE_FALLBACK) => CODE_FALLBACK[l].map((o) => o.slug);

describe("revenue lists match the values stored today", () => {
  // The matcher and validation read profile/options.ts; the page seeds from
  // CODE_FALLBACK. Drift here would offer a value the matcher cannot read.
  it("keeps the five lists identical to profile/options", () => {
    expect(slugs("revenue_size")).toEqual([...REVENUE_SIZE_OPTIONS]);
    expect(slugs("arr_band")).toEqual([...ARR_BAND_OPTIONS]);
    expect(slugs("mrr_band")).toEqual([...MRR_BAND_OPTIONS]);
    expect(slugs("money_band")).toEqual([...MONEY_BAND_OPTIONS]);
    expect(slugs("revenue_stage")).toEqual(REVENUE_STAGE_OPTIONS.map((s) => s.id));
    expect(CODE_FALLBACK.revenue_stage.map((s) => s.description)).toEqual(REVENUE_STAGE_OPTIONS.map((s) => s.sub));
  });
});

const opt = (slug: string, label = slug, archived = false): DraftOption => ({ slug, label, archived, description: null });
const rules = { addable: true, slugIsLabel: false };

describe("saving a field", () => {
  const saved = [opt("a", "Alpha"), opt("b", "Beta")];

  it("counts renames, retirements and moves as changes", () => {
    expect(countChanges(saved, saved)).toBe(0);
    expect(countChanges(saved, [opt("a", "Alpha 2"), opt("b", "Beta")])).toBe(1);
    expect(countChanges(saved, [opt("b", "Beta"), opt("a", "Alpha")])).toBe(2);
    expect(countChanges(saved, [...saved, opt("c", "Gamma")])).toBe(1);
  });

  it("never lets an existing option disappear", () => {
    const r = checkSave(saved, [opt("a", "Alpha")], rules);
    expect(r.ok).toBe(false);
  });

  it("refuses new options where the list takes none", () => {
    expect(checkSave(saved, [...saved, opt("c", "Gamma")], { ...rules, addable: false }).ok).toBe(false);
    expect(checkSave(saved, [...saved, opt("c", "Gamma")], rules).ok).toBe(true);
  });

  it("refuses two offered options that read the same", () => {
    expect(checkSave(saved, [opt("a", "Same"), opt("b", "same")], rules).ok).toBe(false);
  });

  it("keeps at least one option offered", () => {
    expect(checkSave(saved, [opt("a", "Alpha", true), opt("b", "Beta", true)], rules).ok).toBe(false);
  });

  it("keys banded values by their label so the matcher can read them", () => {
    expect(newSlug("$5m - $10m", { addable: true, slugIsLabel: true })).toBe("$5m - $10m");
    expect(newSlug("Deep Tech", rules)).toBe("deep-tech");
  });
});

describe("defaults", () => {
  it("restores the built in list and retires anything it does not know", () => {
    const current = [opt("Under $100k", "Below 100k"), opt("custom", "Custom")];
    const next = applyDefault(current, CODE_FALLBACK.revenue_size);
    expect(next.slice(0, 6).map((o) => o.slug)).toEqual([...REVENUE_SIZE_OPTIONS]);
    expect(next.find((o) => o.slug === "Under $100k")?.label).toBe("Under $100k");
    expect(next.find((o) => o.slug === "custom")?.archived).toBe(true);
  });

  it("resets one option's label", () => {
    expect(defaultOne(opt("growing", "Growth"), CODE_FALLBACK.revenue_stage).label).toBe("Growing");
  });
});

describe("CSV", () => {
  it("round trips, keeping options missing from the file", () => {
    const current = [opt("a", 'Alpha, "the first"'), opt("b", "Beta", true)];
    const csv = toCsv([current[0]]);
    const r = fromCsv(csv, current);
    expect(r.ok && r.options).toEqual([current[0], current[1]]);
  });

  it("rejects a file without key and label columns", () => {
    expect(fromCsv("name\nx\n", []).ok).toBe(false);
  });
});

/* ── Where used stays true to the code ─────────────────────────────── */

const ROOT = join(process.cwd(), "src");
function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(f) && !/\.test\./.test(f)) out.push(p);
  }
  return out;
}

describe("Where used", () => {
  it("covers every managed section", () => {
    for (const s of FIELD_SECTIONS) {
      expect(FIELD_USAGE.some((u) => u.list === s.list), s.title).toBe(true);
    }
  });

  it("lists every screen that uses a field's option list", () => {
    // Screens only: pages and components. Libraries, API routes and this page's
    // own code are the plumbing, not places a field is asked.
    const files = [...walk(join(ROOT, "app")), ...walk(join(ROOT, "components"))]
      .filter((p) => !p.includes(`${join("app", "api")}`) && !p.includes("ProfileFieldsManager"));
    const missing: string[] = [];
    for (const [token, field] of Object.entries(LIST_CONSTANTS)) {
      const usage = FIELD_USAGE.filter((u) => u.name === field || (field === "Amount of capital" && u.name === "Annual EBITDA"));
      const refs = new Set(usage.flatMap((u) => u.codeRefs));
      const re = new RegExp(token.startsWith("re:") ? token.slice(3) : `\\b${token}\\b`);
      for (const p of files) {
        const rel = p.slice(process.cwd().length + 1);
        if (re.test(readFileSync(p, "utf8")) && !refs.has(rel)) missing.push(`${field}: ${rel}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
