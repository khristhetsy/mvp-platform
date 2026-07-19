// COUNSEL-REVIEWABLE FILE — all public-facing marketplace strings live here
// (hero, lane explainer, Rule 206 disclaimer, card disclosure, compliance footer,
// empty state, private-lane CTA). Verbatim from the approved mockup
// (icapos-marketplace-compliant-mockup.html). Do not scatter copy into components.

export const marketplaceCopy = {
  nav: {
    links: [
      { label: "Overview", href: "/" },
      { label: "Marketplace", href: "/marketplace", active: true },
      { label: "Founders", href: "/founders" },
      { label: "Investors", href: "/investors" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  hero: {
    kicker: "The iCapOS Marketplace",
    title: "Regulation Crowdfunding offerings, scored for readiness.",
    sub: "Every listing below is a Reg CF offering conducted on an SEC-registered funding portal. iCapOS is a discovery and readiness layer — investing happens on the portal, never here.",
  },
  lanes: {
    cf: {
      heading: "Reg CF offerings — listed publicly",
      body: "Reg CF permits public advertising. Cards show basic terms only and link to the registered portal hosting the offering.",
    },
    rd: {
      heading: "Private raises — never listed",
      body: "Reg D offerings stay off public pages by law. Those founders connect with investors through private, permissioned matching.",
    },
  },
  section: {
    heading: "Live Reg CF offerings",
    sampleTag: "Sample layout — fictional companies",
    sampleNote: "All company names and figures below are fictional, shown to illustrate the listing format. Real listings appear after admin review.",
  },
  empty: {
    heading: "Curated Reg CF offerings launching soon",
    body: "We're reviewing Reg CF offerings now. Check back shortly, or submit your company to be considered.",
    ctaLabel: "Submit your company",
    ctaHref: "/submit-company",
  },
  card: {
    badge: "REG CF",
    portalCtaPrefix: "View offering on ",
    portalCtaSuffix: " →",
    expressInterest: "Express interest",
    opensNewTab: "(opens in new tab)",
    terms: { security: "Security", raiseRange: "Raise range", readiness: "Readiness", portal: "Portal" },
    disclosure:
      "This is a notice of an offering conducted on a registered funding portal. iCapOS is not a broker-dealer or funding portal and is not involved in this offering.",
  },
  expressInterest: {
    rule206Lead: "Non-binding indication of interest.",
    rule206Body:
      "No money or other consideration is being solicited, and if sent, will not be accepted. No offer to buy can be accepted and no part of the purchase price can be received until the offering is live on the registered funding portal, and any indication of interest involves no obligation or commitment of any kind.",
    nameLabel: "Full name",
    emailLabel: "Email",
    amountLabel: "Intended amount (optional)",
    amountNote: "Any amount entered is informational only and creates no commitment.",
    submit: "Submit non-binding interest",
    submitting: "Submitting…",
    success: "✓ Interest recorded — you'll be notified when the offering is live on the portal.",
    closedError: "This offering is no longer collecting interest.",
    genericError: "Something went wrong. Please try again.",
  },
  privateCta: {
    heading: "Looking for private-market deal flow?",
    body: "Reg D opportunities are never listed publicly. Verified investors receive curated, fit-scored introductions through private matching — anonymized until both sides consent. Accreditation verification required for accredited-only offerings.",
    ctaLabel: "Request verified investor access",
    ctaHref: "/investors/request-access",
  },
  footer: {
    lead: "Important compliance notice.",
    body: "iCFO CapitalOS is a software platform operated by iCFO Capital Global, Inc. It is not a registered broker-dealer, funding portal, or investment adviser, and does not offer, sell, or recommend securities. Listings on this page are notices of Regulation Crowdfunding offerings conducted on SEC-registered funding portals; all investments are made on the applicable portal. Indications of interest are non-binding. Nothing on this platform is investment advice, a recommendation, or a guarantee of funding, investor participation, allocations, returns, or liquidity. Private offerings are risky and may result in loss of capital. Investors must conduct independent due diligence.",
  },
} as const;
