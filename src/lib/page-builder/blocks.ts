import type { PageBlock, PageBlockType } from "@/lib/page-builder/types";

export type BlockDefinition = {
  type: PageBlockType;
  label: string;
  description: string;
  defaultProps: Record<string, unknown>;
};

export const BLOCK_DEFINITIONS: BlockDefinition[] = [
  {
    type: "hero",
    label: "Hero",
    description: "Headline, subheadline, and primary CTAs",
    defaultProps: {
      eyebrow: "Capital readiness infrastructure",
      headline: "The operating system for capital-ready companies.",
      subheadline:
        "AI diligence, investor readiness, data rooms, and marketplace preparation — all in one institutional platform.",
      primaryCtaLabel: "Get Started as Founder",
      primaryCtaHref: "/submit-company",
      secondaryCtaLabel: "Explore as Investor",
      secondaryCtaHref: "/investors",
    },
  },
  {
    type: "trust_badges",
    label: "Trust badges",
    description: "Compliance and security trust row",
    defaultProps: {
      badges: ["AI-Powered Diligence", "Bank-Grade Security", "Built for Compliance"],
    },
  },
  {
    type: "feature_grid",
    label: "Feature grid",
    description: "Card grid for product capabilities",
    defaultProps: {
      title: "Platform capabilities",
      items: [
        { title: "AI Diligence", body: "Summarize documents and flag diligence gaps." },
        { title: "Investor Readiness", body: "Structured readiness scoring and remediation." },
        { title: "Secure Data Rooms", body: "Private document rooms with role-based access." },
        { title: "Marketplace Access", body: "Admin-reviewed opportunity publication workflow." },
      ],
    },
  },
  {
    type: "metrics_row",
    label: "Metrics row",
    description: "KPI-style metric cards",
    defaultProps: {
      metrics: [
        { label: "Readiness Score", value: "87/100" },
        { label: "Diligence Completeness", value: "92%" },
        { label: "Investor Interest", value: "23" },
      ],
    },
  },
  {
    type: "cta_band",
    label: "CTA band",
    description: "Call-to-action strip with button",
    defaultProps: {
      title: "Build a capital-ready company profile",
      body: "Organize diligence, validate traction, and prepare for investor review.",
      ctaLabel: "Submit company",
      ctaHref: "/submit-company",
    },
  },
  {
    type: "text_section",
    label: "Text section",
    description: "Simple heading and body copy",
    defaultProps: {
      eyebrow: "Section",
      title: "Institutional workflow",
      body: "Draft content for lab preview only. Production pages are unchanged in Phase 1.",
    },
  },
  {
    type: "image_banner",
    label: "Image banner",
    description: "Full-width image with optional caption",
    defaultProps: {
      imageUrl: "/capitalos-wordmark.png",
      alt: "CapitalOS",
      caption: "Lab preview image — replace URL as needed",
    },
  },
  {
    type: "spacer",
    label: "Spacer",
    description: "Vertical spacing",
    defaultProps: { size: "md" },
  },
];

export function getBlockDefinition(type: PageBlockType) {
  return BLOCK_DEFINITIONS.find((b) => b.type === type);
}

export function createBlock(type: PageBlockType): PageBlock {
  const def = getBlockDefinition(type);
  return {
    id: crypto.randomUUID(),
    type,
    visible: true,
    props: { ...(def?.defaultProps ?? {}) },
  };
}
