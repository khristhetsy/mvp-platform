// Plan-gated "Present at event" tiers.
// Basic        → Founder Spotlight (a 1 minute pitch from a YouTube link)
// Professional → Full presentation (live stage slot, uploaded video)
// Managed IR   → Full presentation (done-for-you)
// Free         → no presenting (must upgrade).
import type { PlanType } from "@/lib/subscriptions/plans";

export type PresentFeature = { id: string; label: string; optional?: boolean };

export type PresentTier = {
  key: "spotlight" | "full";
  label: string;
  /** Maps onto the existing speaker_applications.kind enum. */
  kind: "founder_showcase" | "presenter";
  requiresVideo: boolean;
  blurb: string;
  features: PresentFeature[];
};

export const SPOTLIGHT: PresentTier = {
  key: "spotlight",
  label: "Founder Spotlight",
  kind: "founder_showcase",
  requiresVideo: false,
  blurb: "Your 1 minute pitch plays from your YouTube link in the Founder Spotlight, with a place in the lineup and your own booth.",
  features: [
    { id: "lineup", label: "Place in the Founder Spotlight lineup" },
    { id: "video1", label: "1 minute pitch from a YouTube link, played as submitted" },
    { id: "booth", label: "Your own virtual booth" },
    { id: "networking", label: "Investor networking opt-in", optional: true },
  ],
};

const FULL: PresentTier = {
  key: "full",
  label: "Full presentation",
  kind: "presenter",
  requiresVideo: true,
  blurb: "A live Main Stage slot with your uploaded video presentation, Q&A, and featured placement.",
  features: [
    { id: "stage", label: "Live stage presentation slot" },
    { id: "video_full", label: "Uploaded video presentation" },
    { id: "qa", label: "Live Q&A / panel" },
    { id: "featured", label: "Featured placement in the lineup" },
    { id: "analytics", label: "Presentation engagement analytics", optional: true },
    { id: "networking", label: "Investor networking opt-in", optional: true },
  ],
};

/** The presenting tier a plan unlocks, or null when the plan can't present yet. */
export function presentTierForPlan(plan: PlanType): PresentTier | null {
  if (plan === "founder_basic") return SPOTLIGHT;
  if (plan === "founder_professional" || plan === "founder_premium" || plan === "founder_managed_ir" || plan === "admin_internal") return FULL;
  return null;
}

/** Founder Spotlight is open to the Basic plan only (admin_internal for staff testing). */
export function canSpotlight(plan: PlanType): boolean {
  return plan === "founder_basic" || plan === "admin_internal";
}
