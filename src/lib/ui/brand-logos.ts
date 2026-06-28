export type CapitalOSLogoVariant = "full" | "wordmark" | "icon" | "stacked";

/** Official iCapOS brand assets — do not recolor or substitute.
 *  full/wordmark = horizontal lockup; stacked = vertical lockup; icon = emblem. */
export const CAPITALOS_LOGO_SRC: Record<CapitalOSLogoVariant, string> = {
  full: "/icapos-logo.png",
  wordmark: "/icapos-logo.png",
  icon: "/icapos-logo.png",
  stacked: "/icapos-logo-stacked.png",
};

/** Layout width hints for Next/Image; aspect ratio comes from the asset via object-contain. */
export const CAPITALOS_LOGO_WIDTH_RATIO: Record<CapitalOSLogoVariant, number> = {
  icon: 1,
  wordmark: 2.45,
  full: 2.45,
  stacked: 0.73,
};

export const DEFAULT_LOGO_HEIGHT: Record<CapitalOSLogoVariant, number> = {
  icon: 32,
  wordmark: 28,
  full: 48,
  stacked: 96,
};
