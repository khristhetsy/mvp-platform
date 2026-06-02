export type CapitalOSLogoVariant = "full" | "wordmark" | "icon";

/** Official CapitalOS brand assets — do not recolor or substitute. */
export const CAPITALOS_LOGO_SRC: Record<CapitalOSLogoVariant, string> = {
  full: "/capitalos-logo.png",
  wordmark: "/capitalos-wordmark.png",
  icon: "/capitalos-icon.png",
};

/** Layout width hints for Next/Image; aspect ratio comes from the asset via object-contain. */
export const CAPITALOS_LOGO_WIDTH_RATIO: Record<CapitalOSLogoVariant, number> = {
  icon: 396 / 208,
  wordmark: 588 / 161,
  full: 913 / 209,
};

export const DEFAULT_LOGO_HEIGHT: Record<CapitalOSLogoVariant, number> = {
  icon: 32,
  wordmark: 28,
  full: 48,
};
