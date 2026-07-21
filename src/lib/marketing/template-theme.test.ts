import { describe, it, expect } from "vitest";
import {
  applyPreset,
  DEFAULT_THEME,
  parseDocument,
  THEME_PRESETS,
  type TemplateTheme,
} from "./template-theme";
import type { TemplateBlock } from "./template-blocks";

describe("parseDocument", () => {
  it("reads a versioned document", () => {
    const doc = parseDocument({
      version: 2,
      theme: { ...DEFAULT_THEME, pageBg: "#000000" },
      blocks: [{ id: "1", type: "text", text: "Hi" }],
    });
    expect(doc?.theme.pageBg).toBe("#000000");
    expect(doc?.blocks).toHaveLength(1);
  });

  it("still reads templates saved as a bare blocks array", () => {
    // Templates saved before themes existed must keep opening, not error.
    const doc = parseDocument([{ id: "1", type: "text", text: "Legacy" }]);
    expect(doc?.blocks).toHaveLength(1);
    expect(doc?.theme).toEqual(DEFAULT_THEME);
  });

  it("fills in missing theme keys rather than leaving them undefined", () => {
    const doc = parseDocument({ version: 2, theme: { pageBg: "#fff" }, blocks: [] });
    expect(doc?.theme.fontFamily).toBe(DEFAULT_THEME.fontFamily);
    expect(doc?.theme.contentWidth).toBe(DEFAULT_THEME.contentWidth);
  });

  it("returns null for empty, missing, or malformed values", () => {
    expect(parseDocument(null)).toBeNull();
    expect(parseDocument(undefined)).toBeNull();
    expect(parseDocument([])).toBeNull();
    expect(parseDocument("nonsense")).toBeNull();
    expect(parseDocument({ version: 2 })).toBeNull();
  });
});

describe("theme presets", () => {
  it("every preset carries a complete theme", () => {
    for (const p of THEME_PRESETS) {
      const keys = Object.keys(DEFAULT_THEME) as Array<keyof TemplateTheme>;
      for (const k of keys) expect(p.theme[k]).toBeDefined();
    }
  });

  it("recolours bands, buttons, and callouts when applied", () => {
    const blocks: TemplateBlock[] = [
      { id: "1", type: "section", heading: "Band", bg: "#000000" },
      { id: "2", type: "button", label: "Go", url: "https://icapos.com", bg: "#000000" },
      { id: "3", type: "callout", text: "Note", borderColor: "#000000" },
    ];
    const teal = THEME_PRESETS.find((p) => p.id === "teal");
    if (!teal) throw new Error("teal preset missing");
    const next = applyPreset(teal, blocks);
    expect(next.find((b) => b.type === "section")).toMatchObject({ bg: teal.sectionBg });
    expect(next.find((b) => b.type === "button")).toMatchObject({ bg: teal.accent });
    expect(next.find((b) => b.type === "callout")).toMatchObject({ borderColor: teal.accent });
  });

  it("leaves content untouched when applying a preset", () => {
    const blocks: TemplateBlock[] = [{ id: "1", type: "text", text: "Keep me" }];
    expect(applyPreset(THEME_PRESETS[0], blocks)).toEqual(blocks);
  });
});
