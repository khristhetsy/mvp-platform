// Design settings for the Announcement, Newsletter and Promo designs: banner,
// logo, accent color and alignment. Stored per template in slot_values under
// the design_* keys and turned into the designs' tokens at render time.
// Client-safe and pure: the editor, the preview and the send path share it.

import type { PlaceholderSchema } from "./template-schema";

export type BannerStyle = "brand" | "image" | "none";
export type LogoChoice = "icfo" | "icapos" | "company";
export type Align = "left" | "center";
export type DesignSettings = { banner: BannerStyle; logo: LogoChoice; accent: string; align: Align };

export const DESIGN_KEYS = {
  banner: "design_banner",
  logo: "design_logo",
  accent: "design_accent",
  align: "design_align",
  /** Uploaded company logo, used when logo = company. */
  logoImage: "logo_image",
  /** Banner image, used when banner = image. */
  bannerImage: "banner_image",
} as const;

export const NAVY = "#0A1A40";
export const BRAND_BLUE = "#1A6CE4";
export const ACCENT_SWATCHES = [BRAND_BLUE, NAVY, "#185FA5"];

const APP = (process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com").replace(/\/+$/, "");
/** Each logo in a version for light and for dark backgrounds. */
const LOGOS: Record<Exclude<LogoChoice, "company">, { light: string; dark: string }> = {
  icfo: { light: `${APP}/email/icfo-logo.png`, dark: `${APP}/email/icfo-logo-white.png` },
  icapos: { light: `${APP}/email-logo.png`, dark: `${APP}/icapos-logo-white.png` },
};

/** Designs that carry the design settings (their schema locks the design tokens). */
export function hasDesign(schema: PlaceholderSchema | null | undefined): boolean {
  return !!schema?.locked.includes("accent_color");
}

const isHex = (s: string | undefined): s is string => !!s && /^#[0-9a-f]{6}$/i.test(s);
const isHttp = (s: string | undefined): s is string => !!s && /^https?:\/\//i.test(s.trim());

export function defaultDesign(masterName: string): DesignSettings {
  return { banner: "brand", logo: "icfo", accent: BRAND_BLUE, align: masterName === "Promo" ? "center" : "left" };
}

export function readDesign(values: Record<string, string>, masterName: string): DesignSettings {
  const d = defaultDesign(masterName);
  const b = values[DESIGN_KEYS.banner];
  const l = values[DESIGN_KEYS.logo];
  const a = values[DESIGN_KEYS.align];
  return {
    banner: b === "image" || b === "none" || b === "brand" ? b : d.banner,
    logo: l === "icapos" || l === "company" || l === "icfo" ? l : d.logo,
    accent: isHex(values[DESIGN_KEYS.accent]) ? values[DESIGN_KEYS.accent] : d.accent,
    align: a === "center" || a === "left" ? a : d.align,
  };
}

export function writeDesign(values: Record<string, string>, d: Partial<DesignSettings>): Record<string, string> {
  const out = { ...values };
  if (d.banner) out[DESIGN_KEYS.banner] = d.banner;
  if (d.logo) out[DESIGN_KEYS.logo] = d.logo;
  if (d.accent) out[DESIGN_KEYS.accent] = d.accent;
  if (d.align) out[DESIGN_KEYS.align] = d.align;
  return out;
}

/** The tokens the designs read, from the stored settings. */
export function designTokens(values: Record<string, string>, masterName: string): Record<string, string> {
  const d = readDesign(values, masterName);
  const image = d.banner === "image" && isHttp(values[DESIGN_KEYS.bannerImage]) ? values[DESIGN_KEYS.bannerImage].trim() : "";
  const dark = d.banner !== "none";
  const company = values[DESIGN_KEYS.logoImage];
  const logo = d.logo === "company" && isHttp(company) ? company.trim() : LOGOS[d.logo === "icapos" ? "icapos" : "icfo"][dark ? "dark" : "light"];
  return {
    banner_image: image,
    banner_bg: dark ? NAVY : "#FFFFFF",
    banner_text: dark ? "#FFFFFF" : NAVY,
    banner_border: dark ? "none" : `3px solid ${NAVY}`,
    banner_align: d.align,
    logo_url: logo,
    accent_color: d.accent,
  };
}

export type Look = { name: string; description: string; design: DesignSettings };

/**
 * Suggested looks for a founder, built from fixed rules (no AI service):
 * the iCFO classic look always; a company-photo and a company-colors look when
 * the company has a banner; a minimal look; then variations for "More".
 */
export function suggestLooks(ctx: { company: string; hasBanner: boolean; hasLogo: boolean; bannerColor: string | null }): Look[] {
  const co = ctx.company.trim() || "the company";
  const looks: Look[] = [{ name: "iCFO classic", description: "Navy banner, iCFO logo, brand blue", design: { banner: "brand", logo: "icfo", accent: BRAND_BLUE, align: "left" } }];
  if (ctx.hasBanner) {
    looks.push({ name: "Company photo", description: `${co} banner, navy band, brand blue`, design: { banner: "image", logo: ctx.hasLogo ? "company" : "icfo", accent: BRAND_BLUE, align: "left" } });
    if (ctx.bannerColor) looks.push({ name: "Company colors", description: `${co} banner, color from the banner, centered`, design: { banner: "image", logo: ctx.hasLogo ? "company" : "icfo", accent: ctx.bannerColor, align: "center" } });
  }
  looks.push({ name: "Minimal", description: "No banner, iCapOS logo, navy", design: { banner: "none", logo: "icapos", accent: NAVY, align: "left" } });
  // Variations shown by "More suggestions".
  looks.push({ name: "iCapOS on navy", description: "Navy banner, iCapOS logo, brand blue", design: { banner: "brand", logo: "icapos", accent: BRAND_BLUE, align: "left" } });
  looks.push({ name: "Centered classic", description: "Navy banner, iCFO logo, centered", design: { banner: "brand", logo: "icfo", accent: BRAND_BLUE, align: "center" } });
  if (ctx.hasBanner) looks.push({ name: "Photo, centered", description: `${co} banner, steel blue, centered`, design: { banner: "image", logo: "icfo", accent: "#185FA5", align: "center" } });
  looks.push({ name: "Minimal iCFO", description: "No banner, iCFO logo, brand blue", design: { banner: "none", logo: ctx.hasLogo ? "company" : "icfo", accent: BRAND_BLUE, align: "left" } });
  return looks;
}

/** Strongest saturated color in RGBA pixels, as #rrggbb; null for a grey image. */
export function dominantColor(rgba: ArrayLike<number>): string | null {
  type Bucket = { count: number; sat: number; r: number; g: number; b: number };
  const buckets = new Map<string, Bucket>();
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2], a = rgba[i + 3];
    if (a < 128) continue;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    if (sat < 0.45 || max < 60) continue;
    const key = `${r >> 5},${g >> 5},${b >> 5}`;
    const e = buckets.get(key) ?? { count: 0, sat: 0, r: 0, g: 0, b: 0 };
    e.count += 1; e.sat += sat; e.r += r; e.g += g; e.b += b;
    buckets.set(key, e);
  }
  let best: Bucket | null = null;
  for (const e of buckets.values()) if (!best || e.sat > best.sat) best = e;
  if (!best) return null;
  return readableOnWhite([best.r / best.count, best.g / best.count, best.b / best.count]);
}

const lum = ([r, g, b]: number[]) => {
  const ch = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
};

/** Darken a color until white text on it reaches 4.5:1 contrast (WCAG AA), as #rrggbb. */
export function readableOnWhite(rgb: number[]): string {
  let [r, g, b] = rgb;
  for (let i = 0; i < 40 && 1.05 / (lum([r, g, b]) + 0.05) < 4.5; i++) { r *= 0.92; g *= 0.92; b *= 0.92; }
  const hex = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/** Founder data mapped onto each design's fields (Deal introduction uses the values as is). */
export function mapFounderValues(masterName: string, v: Record<string, string>, website?: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  const set = (k: string, val: string | undefined) => { if (val && val.trim()) out[k] = val.trim(); };
  const firstSentence = (t: string, max: number) => {
    const s = (t.match(/^.*?[.!?](\s|$)/)?.[0] ?? t).trim();
    if (s.length <= max) return s;
    const cut = s.slice(0, max - 1);
    return `${cut.slice(0, cut.lastIndexOf(" ")).trim()}…`;
  };
  if (masterName === "Deal introduction") return { ...v };
  if (v.hero_image) set(DESIGN_KEYS.bannerImage, v.hero_image);
  const headline = v.headline ?? "";
  if (masterName === "Announcement") {
    set("headline", headline.slice(0, 90));
    set("body", v.body);
  } else if (masterName === "Newsletter") {
    set("headline", headline.slice(0, 90));
    set("intro", v.body);
    if (v.considerations) { set("section_one_title", "Highlights"); set("section_one_body", v.considerations); }
    if (v.terms) { set("section_two_title", "Terms"); set("section_two_body", v.terms); }
  } else if (masterName === "Promo") {
    set("headline", headline.slice(0, 70));
    if (v.body) set("subhead", firstSentence(v.body, 120));
  }
  if (website) set("cta_url_fallback", website);
  return out;
}
