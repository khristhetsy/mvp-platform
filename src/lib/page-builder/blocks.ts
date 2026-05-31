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
  {
    type: "testimonial",
    label: "Testimonial",
    description: "Customer or partner quote with attribution",
    defaultProps: {
      quote: "CapitalOS helped our team organize diligence and present a credible investor narrative.",
      name: "Jordan Lee",
      title: "CEO, Northwind Analytics",
      avatarUrl: "",
      avatarAlt: "",
      rating: 5,
    },
  },
  {
    type: "faq",
    label: "FAQ",
    description: "Expandable question and answer list",
    defaultProps: {
      title: "Frequently asked questions",
      items: [
        {
          question: "Is this connected to live production pages?",
          answer: "No. Page Builder Lab drafts are sandbox-only in Phase 1.",
        },
        {
          question: "Who can access the admin lab?",
          answer: "Authorized internal users with page builder permissions.",
        },
      ],
    },
  },
  {
    type: "process_steps",
    label: "Process steps",
    description: "Numbered workflow steps with icons",
    defaultProps: {
      title: "How it works",
      subtitle: "A structured path from readiness to review.",
      steps: [
        { icon: "check", title: "Prepare", description: "Organize documents and readiness inputs." },
        { icon: "shield", title: "Review", description: "Validate diligence context and disclosures." },
        { icon: "rocket", title: "Engage", description: "Share curated opportunities with investors." },
      ],
    },
  },
  {
    type: "pricing_plan",
    label: "Pricing plan",
    description: "Single plan card with features and CTA",
    defaultProps: {
      planName: "Growth",
      priceLabel: "From $499 / month",
      features: ["Readiness scoring", "Secure data room", "Investor CRM workspace"],
      ctaLabel: "Request access",
      ctaHref: "/submit-company",
      highlighted: false,
    },
  },
  {
    type: "compliance_notice",
    label: "Compliance notice",
    description: "Regulatory disclaimer block for investor-facing pages",
    defaultProps: {
      title: "Important disclosure",
      body: "CapitalOS provides educational and workflow tools. Nothing on this page constitutes an offer, solicitation, or investment advice.",
      style: "legal",
      required: true,
    },
  },
  {
    type: "team",
    label: "Team member",
    description: "Leadership profile with bio and optional LinkedIn",
    defaultProps: {
      name: "Alex Morgan",
      title: "Managing Partner",
      bio: "Leads platform strategy and institutional partnerships.",
      imageUrl: "/capitalos-icon.png",
      imageAlt: "Alex Morgan headshot",
      linkedInUrl: "",
    },
  },
  {
    type: "logo_cloud",
    label: "Logo cloud",
    description: "Partner or customer logo row with required alt text",
    defaultProps: {
      title: "Trusted by capital-ready teams",
      logos: [
        { imageUrl: "/capitalos-wordmark.png", alt: "CapitalOS" },
        { imageUrl: "/capitalos-icon.png", alt: "CapitalOS icon" },
      ],
    },
  },
  {
    type: "stats_comparison",
    label: "Stats comparison",
    description: "Before/after or category metric comparison",
    defaultProps: {
      title: "Readiness impact",
      items: [
        {
          category: "Before CapitalOS",
          label: "Diligence completeness",
          value: "54%",
          description: "Fragmented documents and inconsistent updates.",
        },
        {
          category: "After CapitalOS",
          label: "Diligence completeness",
          value: "92%",
          description: "Structured workflow with review-ready context.",
        },
      ],
    },
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
