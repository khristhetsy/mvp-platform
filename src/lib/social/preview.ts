/**
 * Pure helpers for the Compose post preview. No network calls, no paid AI.
 * Previews are approximate: they show how a post reads on each network, not a pixel match.
 */
import { NETWORK_LIMITS, type Network } from "@/lib/social/templates";

export const PLATFORM_LABEL_SHARED: Record<Network, string> = {
  linkedin: "LinkedIn",
  facebook: "Facebook",
  instagram: "Instagram",
  reddit: "Reddit",
};

export type PreviewParts = { title: string | null; text: string; limit: number; note: string };

export function previewParts(network: Network, body: string, hasLink: boolean): PreviewParts {
  const limit = NETWORK_LIMITS[network];
  const clean = body.trim();
  if (network === "reddit") {
    const [first = "", ...rest] = clean.split(/\r?\n/);
    const remainder = rest.join("\n").trim();
    return {
      title: first.slice(0, 120) || null,
      text: remainder,
      limit,
      note: "Reddit shows the first line as the title.",
    };
  }
  const note =
    network === "instagram"
      ? "Instagram posts need an image."
      : hasLink
        ? "Your tracked link posts as the first comment."
        : "Add a tracked link to post it as the first comment.";
  return { title: null, text: clean, limit, note };
}
