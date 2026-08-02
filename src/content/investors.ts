/**
 * Investors page copy — ported VERBATIM from icapos-site-mock.html (spec §6, §13).
 * Section order (§6): hero + volume-cap panel → the investor problem + three
 * metrics → why the cap exists → mandate parser + match explorer → investor
 * workspace → closing CTA. Compliance load-bearing.
 */
export const investors = {
  hero: {
    eyebrow: "For investors",
    title: "Rated deal flow, at a volume you set.",
    sub: "Accounts are free. You define your mandate and your monthly limit — and you never receive more than you agreed to. Every company arrives with a readiness rating already attached.",
    primaryCta: { label: "Create a free account", href: "/start" },
    secondaryCta: { label: "Attend the Expo", href: "/events" },
    compliance: "iCapOS is pledge-only. No transactions, subscriptions, or funds are processed on the platform.",
    panel: {
      title: "Your volume preferences",
      badge: "Active",
      cap: { label: "Monthly acceptance cap", sub: "Resets on the 1st · 7 of 12 used", max: "12 max" },
      rows: [
        { k: "Sectors", v: "Fintech · B2B software · Climate" },
        { k: "Stage", v: "Seed through Series A" },
        { k: "Check size", v: "$250K – $2M" },
        { k: "Geography", v: "US · Canada · Western Europe" },
      ],
      footA: "Change these any time",
      footB: "Illustrative settings",
    },
  },

  problem: {
    eyebrow: "The problem",
    title: "Getting to a decision-ready deal is the hard part.",
    intro: "The decision itself isn't what costs you. It's everything that happens before you're in a position to make one.",
    items: [
      { h: "Deal-flow noise", p: "Over a thousand pitches a year, and roughly 70% are thesis-mismatched on stage, sector, cheque size or geography. Sourcing quality, not quantity, is the bottleneck." },
      { h: "Diligence cost and time", p: "Weeks of analyst time per serious diligence — most of it spent chasing missing documents rather than evaluating the business." },
      { h: "Information asymmetry", p: "Incomplete data rooms, unaudited claims, inconsistent formats. No standardized signal to compare companies before you commit diligence resources." },
      { h: "Late-stage dead ends", p: "Deals die in diligence on discoverable issues — cap table problems, financial hygiene, governance gaps — after the cost is already sunk." },
    ],
    metrics: [
      { value: "−50–70%", label: "Screening time per deal, with a readiness score replacing the manual first pass" },
      { value: "3–5×", label: "Qualified deal-flow ratio, filtering on fit rather than taking raw inbound" },
      { value: "30–50%", label: "Faster diligence cycles, from data rooms that arrive in a consistent structure" },
    ],
    modeledNote: "Where these come from. Directionally modeled from industry benchmarks and iCFO's own deal-flow experience — not measured from iCapOS accounts. They describe process efficiency and deal-flow quality. iCapOS never recommends an investment, predicts performance, or implies returns.",
  },

  cap: {
    eyebrow: "Why the cap exists",
    title: "Your inbox is the scarce resource, so you control it.",
    intro: "iCapOS matches on volume accepted rather than volume sent — you set a hard monthly ceiling, and matching respects it even when that leaves a founder's list short.",
    items: [
      { h: "Everything arrives rated", p: "Each company carries a Capital Readiness Rating with a per-dimension breakdown, so you can screen on substance in seconds rather than pages." },
      { h: "Private, not public", p: "There is no public listings board. Company visibility runs through permissioned matching — you can browse and indicate interest privately, and your identity stays protected until you choose to engage." },
      { h: "Fewer dead ends", p: "Cap table, legal and financial hygiene issues are surfaced and remediated before a company is listed — so fewer of your diligence hours end in a discoverable dead end." },
    ],
  },

  explorer: {
    eyebrow: "Try it",
    title: "See how matching behaves.",
    sub: "Set a mandate and watch the list rebuild. Companies shown are fictional samples used to demonstrate the fit logic — not live offerings.",
    parseLabel: "Describe your mandate in plain English",
    parseChips: ["Climate, early", "Healthcare, Series A", "Consumer, seed"],
    parseCta: "Set my criteria",
    filters: [
      { label: "Sector", options: ["All sectors", "B2B software", "Fintech", "Climate", "Healthcare", "Consumer"] },
      { label: "Stage", options: ["Any stage", "Pre-seed", "Seed", "Series A", "Series B+"] },
      { label: "Check size", options: ["Any size", "Under $500K", "$500K – $2M", "$2M – $5M", "$5M+"] },
    ],
    note: "Fit scores are computed live from the criteria above using sample company records.",
  },

  workspace: {
    eyebrow: "Investor workspace",
    title: "What's inside your account.",
    items: [
      { h: "Private Market", p: "Browse rated companies as profiles — grid or list view, live activity ticker, search and filter by sector, stage and check size. Open a profile and request an introduction from there." },
      { h: "Diligence submissions", p: "Submit a company you're already looking at — inside or outside the network — and run it through the same structured diligence framework." },
      { h: "Standardized data rooms", p: "Every deal arrives in the same document structure, so diligence starts on day one instead of after weeks of chasing. Watermarked, with full access logging on every view and download." },
      { h: "Deal syndication", tag: "Fit Score 90+", p: "Bring other investors onto a deal, including investors from the iCFO network by request. No transactions occur on the platform — syndication here is coordination, not execution." },
    ],
    notDo: "What iCapOS does not do. It does not offer or sell securities, effect transactions, hold or transmit funds, provide investment advice, or make recommendations. All investor actions are non-binding indications of interest. iCFO Capital Global, Inc. is not a broker-dealer, funding portal, investment adviser, or placement agent.",
  },

  closing: {
    title: "Fewer, better-fit, diligence-ready deals.",
    sub: "See less, decide faster, and keep every decision your own. Free account, your mandate, your monthly cap.",
    cta: { label: "Create your account", href: "/start" },
  },
} as const;
