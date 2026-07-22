// Template-wide styling for the visual editor.
//
// A theme is applied once and cascades into every block, so a template gets a
// consistent look without setting colours block by block. Stored alongside the
// blocks in the `blocks` jsonb column using a versioned document wrapper.

import type { TemplateBlock } from "./template-blocks";

export type TemplateTheme = {
  /** Email-safe font stack. Web fonts are unreliable in mail clients. */
  fontFamily: string;
  /** Card width in px; 600 is the long-standing safe default. */
  contentWidth: number;
  /** The area behind the card. */
  pageBg: string;
  cardBg: string;
  linkColor: string;
  /** Base line height as a multiplier. */
  baseLeading: number;
  headingColor: string;
  textColor: string;
};

export const FONT_STACKS = [
  { label: "Helvetica · Arial", value: "Helvetica, Arial, sans-serif" },
  { label: "Georgia · serif", value: "Georgia, 'Times New Roman', serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Tahoma", value: "Tahoma, Verdana, sans-serif" },
  { label: "Courier", value: "'Courier New', Courier, monospace" },
] as const;

export const DEFAULT_THEME: TemplateTheme = {
  fontFamily: "Helvetica, Arial, sans-serif",
  contentWidth: 600,
  pageBg: "#f6f8fc",
  cardBg: "#ffffff",
  linkColor: "#2E78F5",
  baseLeading: 1.6,
  headingColor: "#0c2340",
  textColor: "#3a4a63",
};

export type ThemePreset = {
  id: string;
  label: string;
  /** Swatches shown in the picker: [band, page]. */
  swatch: [string, string];
  theme: TemplateTheme;
  /** Band colour applied to section blocks when the preset is chosen. */
  sectionBg: string;
  accent: string;
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "navy",
    label: "Navy corporate",
    swatch: ["#0c2340", "#f4f6fa"],
    sectionBg: "#0c2340",
    accent: "#2E78F5",
    theme: { ...DEFAULT_THEME },
  },
  {
    id: "violet",
    label: "Violet digest",
    swatch: ["#5B4BE0", "#f4f2fe"],
    sectionBg: "#5B4BE0",
    accent: "#5B4BE0",
    theme: { ...DEFAULT_THEME, pageBg: "#f4f2fe", linkColor: "#5B4BE0", headingColor: "#2b2170" },
  },
  {
    id: "teal",
    label: "Teal report",
    swatch: ["#0F6E56", "#f0f7f4"],
    sectionBg: "#0F6E56",
    accent: "#0F6E56",
    theme: { ...DEFAULT_THEME, pageBg: "#f0f7f4", linkColor: "#0F6E56", headingColor: "#08402f" },
  },
  {
    id: "letter",
    label: "Plain letter",
    swatch: ["#2C2C2A", "#ffffff"],
    sectionBg: "#2C2C2A",
    accent: "#2C2C2A",
    theme: {
      ...DEFAULT_THEME,
      fontFamily: "Georgia, 'Times New Roman', serif",
      pageBg: "#ffffff",
      linkColor: "#2C2C2A",
      headingColor: "#1c1c1a",
      contentWidth: 560,
    },
  },
];

// ── Theme inference (HTML-authored templates) ────────────────────────────────

/** Rough perceived luminance 0..1 for a #hex colour; returns 1 for anything unparsable. */
function luminance(hex: string): number {
  const h = hex.replace(/^#/, "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (!/^[0-9a-f]{6}$/i.test(full)) return 1;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Best-effort theme for a template that has HTML but no stored theme (authored
 * as raw HTML or imported). Only fields we can read with confidence are
 * overridden — everything else keeps the default — so the visual editor's canvas
 * and colour swatches match the email instead of snapping to the navy default.
 */
export function inferThemeFromHtml(html: string): TemplateTheme {
  const theme: TemplateTheme = { ...DEFAULT_THEME };
  if (!html) return theme;

  const font = /font-family:\s*([^;"']+)/i.exec(html)?.[1]?.trim();
  if (font) theme.fontFamily = font;

  // Accent = the first call-to-action button's background (styled inline-block <a>).
  const buttonBg =
    /<a\b[^>]*\bstyle="[^"]*\bbackground(?:-color)?:\s*(#[0-9a-f]{3,6})[^"]*\bdisplay:\s*inline-block/i.exec(html)?.[1] ??
    /<a\b[^>]*\bstyle="[^"]*\bdisplay:\s*inline-block[^"]*\bbackground(?:-color)?:\s*(#[0-9a-f]{3,6})/i.exec(html)?.[1];
  if (buttonBg) theme.linkColor = buttonBg;

  // Heading colour = first *dark* h1/h2 colour (skip white headings that sit on
  // a coloured band, which aren't the body heading colour).
  const headingColor = [...html.matchAll(/<h[12]\b[^>]*\bstyle="[^"]*\bcolor:\s*(#[0-9a-f]{3,6})/gi)]
    .map((m) => m[1])
    .find((c) => luminance(c) < 0.6);
  if (headingColor) theme.headingColor = headingColor;

  // Page background = a light background on a wrapping table/body/div. Prefer a
  // tinted light colour (e.g. #f4f2fe) over plain white so the page tint shows.
  const lightBgs = [
    ...html.matchAll(/<(?:table|body|div)\b[^>]*\bstyle="[^"]*\bbackground(?:-color)?:\s*(#[0-9a-f]{3,6})/gi),
  ]
    .map((m) => m[1])
    .filter((c) => luminance(c) > 0.85);
  const page = lightBgs.find((c) => luminance(c) < 0.995) ?? lightBgs[0];
  if (page) theme.pageBg = page;

  return theme;
}

// ── Document shape ───────────────────────────────────────────────────────────

export type TemplateDocument = {
  version: 2;
  theme: TemplateTheme;
  blocks: TemplateBlock[];
};

/**
 * Read whatever is in the `blocks` column. Templates saved before themes existed
 * hold a bare array; those load with the default theme rather than erroring, so
 * nothing needs migrating.
 */
export function parseDocument(raw: unknown): TemplateDocument | null {
  if (Array.isArray(raw)) {
    return raw.length > 0 ? { version: 2, theme: { ...DEFAULT_THEME }, blocks: raw as TemplateBlock[] } : null;
  }
  if (raw && typeof raw === "object") {
    const candidate = raw as Partial<TemplateDocument>;
    if (Array.isArray(candidate.blocks)) {
      return {
        version: 2,
        theme: { ...DEFAULT_THEME, ...(candidate.theme ?? {}) },
        blocks: candidate.blocks,
      };
    }
  }
  return null;
}

/** Apply a preset: theme values, plus recolouring existing bands and buttons. */
export function applyPreset(preset: ThemePreset, blocks: TemplateBlock[]): TemplateBlock[] {
  return blocks.map((b) => {
    if (b.type === "section") return { ...b, bg: preset.sectionBg };
    if (b.type === "button") return { ...b, bg: preset.accent };
    if (b.type === "callout") return { ...b, borderColor: preset.accent };
    return b;
  });
}
