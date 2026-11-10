/** Sizes and styles for Design with Claude. No server imports, so the Compose page can use it too. */

export const DESIGN_SIZES = {
  banner: { w: 1200, h: 628, label: "Banner 1.91:1", note: "1200 x 628. Best for LinkedIn. Fine on Facebook and Instagram." },
  portrait: { w: 1080, h: 1350, label: "Portrait 4:5", note: "1080 x 1350. Best for Instagram and Facebook." },
  square: { w: 1080, h: 1080, label: "Square 1:1", note: "1080 x 1080. Works on all three." },
} as const;
export type DesignSize = keyof typeof DESIGN_SIZES;

export const DESIGN_STYLES = {
  brand: { label: "iCapOS brand (teal)", colors: { bg1: "#0d9488", bg2: "#164e63", text: "#ffffff", accent: "#fde68a", btnText: "#0f2f3a" } },
  dark: { label: "Dark", colors: { bg1: "#0f172a", bg2: "#1e293b", text: "#ffffff", accent: "#5eead4", btnText: "#0f172a" } },
  light: { label: "Light", colors: { bg1: "#faf8f5", bg2: "#e7e5e4", text: "#1e293b", accent: "#0d9488", btnText: "#ffffff" } },
  gold: { label: "Gold accent", colors: { bg1: "#1e1b4b", bg2: "#312e81", text: "#ffffff", accent: "#fbbf24", btnText: "#1e1b4b" } },
} as const;
export type DesignStyle = keyof typeof DESIGN_STYLES;
