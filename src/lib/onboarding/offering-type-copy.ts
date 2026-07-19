// COUNSEL-REVIEWABLE FILE — all founder-facing strings for the capital-structure
// onboarding step live here. Do not scatter copy into components. Text is verbatim
// from the approved mockup (icapos-offering-type-mockup.html).

import type { OfferingType } from "./offering-type-schema";

/** Where the "consult your securities counsel" link points. */
export const COUNSEL_INFO_URL = "/learn/capital-structures";

type OptionCopy = {
  title: string;
  badge: string;
  badgeVariant: "public" | "private" | "readiness";
  description: string;
};

type ConfirmCopy = {
  variant: "green" | "lock" | "amber";
  lead: string;
  body: string;
};

export const offeringTypeCopy = {
  title: "What's your capital structure?",
  subtitle: "This determines how iCapOS connects you with investors.",
  disclosure: {
    heading: "Only Reg CF offerings appear in the public iCapOS Marketplace.",
    body: "Reg CF permits public advertising of your raise; private offerings (Reg D) do not. If you select a private structure, iCapOS connects you with investors through private, permissioned matching instead — your profile is never publicly visible.",
  },
  options: {
    reg_cf: {
      title: "Regulation Crowdfunding (Reg CF)",
      badge: "Public marketplace",
      badgeVariant: "public",
      description: "Raising through a registered funding portal such as Wefunder, StartEngine, or DealMaker.",
    },
    reg_d_506b: {
      title: "Reg D — Rule 506(b)",
      badge: "Private matching",
      badgeVariant: "private",
      description: "Private round with no general solicitation. Investors come from existing or matched relationships.",
    },
    reg_d_506c: {
      title: "Reg D — Rule 506(c)",
      badge: "Private matching",
      badgeVariant: "private",
      description: "Accredited investors only; general solicitation permitted with accreditation verification.",
    },
    not_raising: {
      title: "Not raising yet",
      badge: "Readiness mode",
      badgeVariant: "readiness",
      description: "Preparing for a future raise and improving your Capital Readiness Rating.",
    },
  } satisfies Record<OfferingType, OptionCopy>,
  confirmations: {
    reg_cf: {
      variant: "green",
      lead: "You're eligible for both the public Marketplace and private Investor Matching.",
      body: "Your marketplace listing will link to your registered funding portal.",
    },
    reg_d_506b: {
      variant: "lock",
      lead: "Your raise stays private.",
      body: "You won't be listed publicly — instead, our matching engine introduces you to fit-scored investors, with your approval on every introduction.",
    },
    reg_d_506c: {
      variant: "lock",
      lead: "Your raise stays private.",
      body: "You'll be matched with verified accredited investors, with your approval on every introduction. Broader visibility options may become available for 506(c) offerings.",
    },
    not_raising: {
      variant: "amber",
      lead: "We'll focus on your Capital Readiness Rating.",
      body: "When you're ready to raise, update your capital structure in Settings to unlock investor connections.",
    },
  } satisfies Record<OfferingType, ConfirmCopy>,
  notSure: {
    summary: "Not sure which applies to you?",
    items: [
      { term: "Reg CF", body: "lets you raise up to $5M per year from the general public, but only through an SEC-registered funding portal or broker-dealer." },
      { term: "Rule 506(b)", body: "is the most common private raise: unlimited amounts from accredited investors you have a relationship with, without public advertising." },
      { term: "Rule 506(c)", body: "allows public advertising, but every investor must be verified as accredited." },
    ],
    counselPrefix: "iCapOS doesn't provide legal advice — if you're unsure, ",
    counselLinkText: "consult your securities counsel",
    counselSuffix: " before selecting.",
  },
  attestation: "I confirm this accurately describes my offering exemption.",
  cta: {
    back: "← Back to company details",
    backHref: "/founder/onboarding",
    continue: "Continue",
    saving: "Saving…",
  },
  legalFooter:
    "iCFO CapitalOS is a software platform. It is not a registered broker-dealer, funding portal, or investment adviser, and does not offer, sell, or recommend securities.",
  progress: {
    steps: ["Account", "Company", "Capital structure", "Readiness intake"],
    current: 3,
  },
  stepLabel: "Founder onboarding",
} as const;

/** Fixed option order per spec: Reg CF, 506(b), 506(c), Not raising. */
export const OPTION_ORDER: OfferingType[] = ["reg_cf", "reg_d_506b", "reg_d_506c", "not_raising"];
