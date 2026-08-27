/**
 * Home page copy — ported VERBATIM from icapos-site-mock.html (spec §6, §13).
 * Section order is deliberate (§6): hero → client logos → how it works → funnel →
 * four causes → readiness split → two sides → gallery/next event → testimonials →
 * pull quote → closing CTA. Compliance load-bearing: flag rather than reword.
 * Figures are directionally modeled — each sits within one screen of its note (§13).
 */
export const home = {
  hero: {
    eyebrow: "Investor relations, run as software",
    title: "Get your company in front of investors whose mandate fits.",
    sub: "We do the heavy lifting on outreach. iCapOS scores your profile against investor mandates in the iCFO network — sector, stage, check size, geography — builds the list, and sends your materials to the ones that fit. You don't need a polished deck to start.",
    primaryCta: { label: "Run your free Readiness Rating", href: "/readiness" },
    secondaryCta: { label: "See plans", href: "/pricing" },
    compliance:
      "iCapOS is a software platform. It is not a broker-dealer, funding portal, investment adviser, or placement agent, and it does not raise capital or guarantee funding.",
    card: {
      label: "Matched investors",
      badge: "Illustrative",
      rows: [
        { initials: "MR", name: "Meridian Ridge Partners", detail: "Seed–A · Climate hardware · $1–3M", fit: "94 fit" },
        { initials: "NC", name: "Northcastle Ventures", detail: "Series A · B2B software · $2–5M", fit: "91 fit" },
        { initials: "HB", name: "Harbor & Vale Capital", detail: "Seed · Marketplaces · $500K–2M", fit: "88 fit" },
        { initials: "QL", name: "Quarrylight Group", detail: "Pre-seed–Seed · Fintech · $250K–1M", fit: "85 fit" },
      ],
      footnoteA: "Ranked by Investor Fit Score",
      footnoteB: "Sample data — not live offerings",
    },
  },

  logos: {
    heading: "A selection of companies iCFO Capital Global has worked with",
    caption:
      "Client and portfolio companies of iCFO Capital Global, Inc. Logos are the property of their respective owners and shown for identification only.",
  },

  howItWorks: {
    eyebrow: "How it works",
    title: "Three steps, and we run two of them.",
    sub: "The sequence matters: we rate you first, so you find the weak spots before an investor does.",
    steps: [
      { n: "01", h: "We rate your readiness", p: "The Capital Readiness Rating scores your company across the dimensions investors screen on, and tells you exactly what to fix. Free, and you can re-run it whenever something changes." },
      { n: "02", h: "We build your investor list", p: "Your profile is matched against investor mandates in the iCFO network. Every match carries an Investor Fit Score, so you can see why each name is on the list." },
      { n: "03", h: "We send on your behalf", p: "Your one-pager or investor newsletter goes out to the matched list, on a cadence each investor has agreed to accept. Replies come straight back to you." },
    ],
    outreachNote:
      "To be precise about what “outreach” means. iCapOS distributes your materials to matched investors. It does not make introductions, vouch for your company, or act as an intermediary in any transaction.",
  },

  funnel: {
    eyebrow: "Why this is hard",
    title: "The math is brutal. That's the point.",
    sub: "Cold-pipeline fundraising loses companies at every stage, and the losses multiply. Knowing where they happen is what tells you which ones are worth attacking.",
    stages: [
      { h: "Cold outreach → response", p: "Hundreds of pitches a week, filtered on thesis mismatch", range: "5–15%" },
      { h: "Response → first meeting", p: "Many replies are polite passes or “keep us posted”", range: "30–50%" },
      { h: "Meeting → diligence", p: "Funds meet 1,000+ companies a year and back 1–2%", range: "10–25%" },
      { h: "Diligence → term sheet", p: "Deals die on cap table, financials, governance, partner veto", range: "30–50%" },
    ],
    closeRate: "0.5–2%",
    closeLabel: "End-to-end close rate on a cold pipeline, multiplied through the four stages above.",
    formula: "0.05 × 0.4 × 0.15 × 0.4",
    footnote:
      "Stage ranges are published industry benchmarks for cold-pipeline private fundraising, not iCapOS results. Related context: CB Insights finds 42% of startup failures trace to no market need, and Carta reports seed-to-Series A graduation falling from 30.6% to 15.4%.",
  },

  causes: {
    eyebrow: "Four reasons, two of them fixable",
    title: "You can't change the math. You can change what you bring to it.",
    items: [
      { tag: "Structural", h: "Supply and demand", p: "A fund writes eight to twelve cheques a year against thousands of inbound companies. That ratio is the base rate.", note: "Nothing fixes this — it's arithmetic.", fixable: false },
      { tag: "Fixable", h: "Thesis mismatch — around 70% of kills", p: "Wrong stage, wrong sector, wrong cheque size, wrong geography. Most rejections aren't a judgement on the company at all.", note: "→ Investor Fit Score, matched targeting", fixable: true },
      { tag: "Structural", h: "Trust deficit", p: "Cold contact starts at zero credibility, and most cheques still come through warm networks.", note: "Partly addressable — a rating and structured materials narrow it, they don't close it.", fixable: false },
      { tag: "Fixable", h: "Readiness failures", p: "Deals die in diligence on discoverable problems — cap table, financial hygiene, governance — after the cost is already sunk.", note: "→ Readiness Rating remediation across five dimensions", fixable: true },
    ],
    thesis:
      "This is the whole thesis. iCapOS attacks the two fixable causes and is honest that it can't touch the other two. Anyone promising to change the base rate is selling you something else.",
  },

  readiness: {
    eyebrow: "Readiness",
    title: "Start where you actually are.",
    paras: [
      "Most platforms want you arriving with a finished deck, a clean cap table and a three-statement model. If you had those, you wouldn't need much help.",
      "Readiness is what iCapOS produces, not what it requires. Run the rating with whatever you have today — a rough deck, a spreadsheet, an idea of the raise — and you'll get back a specific, ordered list of what to fix before investors see it.",
    ],
    cta: { label: "Run the free rating", href: "/readiness" },
    cardTitle: "Capital Readiness Rating",
    cardScore: "0",
    cardBand: "Developing",
    cardNote: "Sample rating. Segments show band position, not a percentile.",
    areas: [
      { label: "Narrative & positioning", score: 78 },
      { label: "Financial model", score: 41 },
      { label: "Traction evidence", score: 66 },
      { label: "Cap table & structure", score: 48 },
      { label: "Team & governance", score: 71 },
    ],
    metrics: [
      { value: "~2×", label: "Investor engagement traction, against the same outreach sent without a rating attached" },
      { value: "30–50%", label: "Faster diligence cycles, from materials that answer the questions before they're asked" },
      { value: "−50–70%", label: "Less wasted outreach, by targeting on mandate fit instead of a mass list" },
    ],
    modeledNote:
      "What these numbers are. Directionally modeled from industry benchmarks and our own engagement data across sixteen years of investor relations work — not measured from iCapOS cohort results, which don't exist yet. They describe engagement traction, never funding likelihood. No one can promise you a raise.",
  },

  twoSides: {
    eyebrow: "Two sides",
    title: "Built for both ends of the table.",
    founders: {
      h: "Founders",
      p: "Get rated, get matched, get your materials in front of investors whose mandate actually fits. Two self-serve plans, no sales call, cancel any time.",
      points: [
        "Up to 25 or up to 100 matched investors per month",
        "Spotlight or a live slot at the iCFO Investment Conference",
        "Every iCapOS tool free, forever — plans only add distribution",
      ],
      cta: { label: "For founders", href: "/founders" },
    },
    investors: {
      h: "Investors",
      p: "Free accounts. You set your own mandate and your own monthly limit on how much you're willing to receive — so your inbox stays proportional to your appetite.",
      points: [
        "Private market of rated companies, with intro requests",
        "Data rooms and diligence workspaces per company",
        "Deal syndication for investors at Fit Score 90+",
      ],
      cta: { label: "For investors", href: "/investors" },
    },
  },

  events: {
    eyebrow: "In the room",
    title: "The events behind the outreach.",
    sub: "Alongside distribution, iCFO runs a monthly conference and an in-person expo series where companies present to investors who choose to attend.",
    formats: [
      { h: "Founder presentations", p: "Professional-plan companies present live to the network." },
      { h: "Investor floor", p: "Open conversations after the presentations." },
      { h: "Spotlight reel", p: "60-second pitches, broadcast to the network." },
    ],
    caption: "Imagery from iCFO Capital Global conference and networking sessions.",
    nextEvent: {
      label: "Next event",
      title: "iCFO PE Expo — Newport Beach",
      detail: "August 25, 2026 · 12:00–4:00 PM PDT · Free registration. Professional-plan founders present live; Basic-plan founders are spotlighted in the pitch reel.",
      cta: { label: "Event details", href: "/events" },
    },
  },

  testimonials: {
    eyebrow: "In their words",
    title: "Founders who have worked with iCFO.",
    intro: "iCapOS is new. The investor relations practice behind it is not — these are founders who came through it before the platform existed.",
    quotes: [
      { initials: "IC", name: "Isaiah Cox", title: "CEO, WheelTug plc", quote: "Money very well spent. Professional, diligent, courteous and, above all, gets results. In advanced stages with several prospective investment partners they had never previously contacted." },
      { initials: "BN", name: "Bob Nunn", title: "CEO, Everactive, Inc.", quote: "An efficient means to get our message in front of qualified investors. Describes the team as organized, efficient, and reliable on follow-through." },
      { initials: "TP", name: "Tim Patrick", title: "CEO, VentisPharma", quote: "We should have contacted them much sooner. Rated iCFO the best of five firms used to reach potential investors." },
      { initials: "DS", name: "Deborah Simpson", title: "CEO, SeedMex", quote: "The benefits far outweighed the cost. Engaged for only a few months, primarily for connections to quality partners." },
      { initials: "MB", name: "Martin Barnet", title: "CEO, Clear Future Synergies", quote: "Solutions-focused, responsive and constructive. Credits the team with helping refine capital strategy for solar PV development in emerging markets." },
      { initials: "FB", name: "Frank Bashore", title: "CEO, 4M&I, LLC", quote: "Their expertise and network of contacts made all the difference. Approached iCFO while struggling to fund a FinTech project." },
    ],
    disclaimer:
      "Testimonials reflect individual client experiences with iCFO Capital Global's advisory and preparation services only. They are not guarantees of funding or investment outcomes, and they do not describe results obtained through the iCapOS platform.",
  },

  pullQuote:
    "A network that stops reading is worth nothing to anyone. So investors set the ceiling, and we hold to it — even when that leaves a founder's list short.",

  closing: {
    pre: "How iCFO has run the investor side for sixteen years",
    title: "See where you stand before you spend a dollar.",
    sub: "The Capital Readiness Rating is free. No call, no card.",
    cta: { label: "Run your free rating", href: "/readiness" },
  },
} as const;
