// Plan-gated "Present at event" tiers.
// Basic        → Spotlight (event spotlight — a curated showcase slot)
// Professional → Full presentation (monthly live stage slot + full video)
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

const SPOTLIGHT: PresentTier = {
  key: "spotlight",
  label: "Spotlight",
  kind: "founder_showcase",
  requiresVideo: false,
  blurb: "A curated showcase slot — your company card, a short pitch video, and a place in the event lineup.",
  features: [
    { id: "lineup", label: "Company card in the event lineup" },
    { id: "video60", label: "60-second pitch video" },
    { id: "logo", label: "Logo on the showcase wall" },
    { id: "networking", label: "Investor networking opt-in", optional: true },
  ],
};

const FULL: PresentTier = {
  key: "full",
  label: "Full presentation",
  kind: "presenter",
  requiresVideo: true,
  blurb: "A live stage slot with a full video presentation, Q&A, and featured placement.",
  features: [
    { id: "stage", label: "Live stage presentation slot" },
    { id: "video_full", label: "Full video presentation" },
    { id: "qa", label: "Live Q&A / panel" },
    { id: "featured", label: "Featured placement in the lineup" },
    { id: "analytics", label: "Presentation engagement analytics", optional: true },
    { id: "networking", label: "Investor networking opt-in", optional: true },
  ],
};

/** The presenting tier a plan unlocks, or null when the plan can't present yet. */
export function presentTierForPlan(plan: PlanType): PresentTier | null {
  if (plan === "founder_basic") return SPOTLIGHT;
  if (plan === "founder_professional" || plan === "founder_managed_ir" || plan === "admin_internal") return FULL;
  return null;
}
