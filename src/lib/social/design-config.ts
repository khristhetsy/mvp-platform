/** Sizes and styles for Design with Claude. No server imports, so the Compose page can use it too. */

export const DESIGN_SIZES = {
  banner: { w: 1200, h: 628, label: "Banner 1.91:1", note: "1200 x 628. Best for LinkedIn. Fine on Facebook and Instagram." },
  portrait: { w: 1080, h: 1350, label: "Portrait 4:5", note: "1080 x 1350. Best for Instagram and Facebook." },
  square: { w: 1080, h: 1080, label: "Square 1:1", note: "1080 x 1080. Works on all three." },
} as const;
export type DesignSize = keyof typeof DESIGN_SIZES;

// Colors follow the site palette in globals.css (site-navy, site-blue, site-amber).
export const DESIGN_STYLES = {
  brand: { label: "iCapOS brand (navy and blue)", colors: { bg1: "#0a1a40", bg2: "#16336b", text: "#ffffff", accent: "#4f94ff", btnText: "#0a1a40" } },
  dark: { label: "Dark", colors: { bg1: "#0f172a", bg2: "#1e293b", text: "#ffffff", accent: "#f2a93b", btnText: "#0f172a" } },
  light: { label: "Light", colors: { bg1: "#f5f7fb", bg2: "#eaf1fe", text: "#0a1a40", accent: "#1a6ce4", btnText: "#ffffff" } },
  amber: { label: "Amber accent", colors: { bg1: "#0a1a40", bg2: "#0f2555", text: "#ffffff", accent: "#f2a93b", btnText: "#0a1a40" } },
} as const;
export type DesignStyle = keyof typeof DESIGN_STYLES;
