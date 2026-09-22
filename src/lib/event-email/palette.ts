/**
 * The event email's colours — one family, six steps.
 *
 * The email had drifted into five hues, three of which were near-misses of
 * tokens the platform already defines: #0c2340 beside `--navy #0A1A40`,
 * #2E78F5 beside `--blue #2563eb`, #0D9488 beside `--teal #0f766e`. Almost
 * matching reads worse than clashing, because it looks accidental rather than
 * chosen. These are the real tokens, mirrored here because an email cannot
 * read CSS variables.
 */

/** globals.css `--navy`. */
export const NAVY = "#0A1A40";
/** globals.css `--blue`. */
export const BLUE = "#2563eb";

export const INK = "#1c2434";
export const BODY = "#5b6b80";
export const MUTED = "#6a7690";
export const LINE = "#e6ebf3";
export const TINT = "#f2f6fd";
export const TINT_LINE = "#dbe6f8";
export const SLATE_BG = "#eef2f7";
export const CARD_BG = "#f7f9fc";

/**
 * A session's marker. Type no longer picks a hue — three weights of one do:
 * the lead session is darkest, anything else on the programme shares the
 * accent, and things that aren't really sessions recede.
 *
 * The badge label already says what kind of session it is, so the colour
 * doesn't need to repeat it.
 */
export type SessionWeight = "lead" | "programmed" | "aside";

export function accentFor(weight: SessionWeight): { bg: string; fg: string } {
  if (weight === "lead") return { bg: NAVY, fg: "#ffffff" };
  if (weight === "programmed") return { bg: BLUE, fg: "#ffffff" };
  return { bg: SLATE_BG, fg: BODY };
}
