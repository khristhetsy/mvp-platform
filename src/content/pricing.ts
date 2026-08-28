/**
 * Pricing page copy. IR-services model: iCapOS sells access to matched investors
 * from iCFO Capital's 6,000+ network. Every company is rated first — that's why
 * the network opens. Three PAID rungs, no free tier and no free trial. All tools
 * ship at every rung; rungs differ by units of access only.
 *   Basic $499 (up to 25, DIY, spotlight) → Professional $1,000 (up to 100, stage,
 *   brokered intros) → Managed IR $3,500 (done-for-you, contact sales).
 */
export const pricing = {
  eyebrow: "Pricing",
  title: "Get in front of matched investors.",
  sub: "iCapOS is investor relations from iCFO Capital — access to matched investors from a network built over 16 years. Every company is rated first; that's why the network opens. Run the outreach yourself, or we run it for you. No success fees, no carry, no commission after an introduction.",
  noTrialNote: "No free trial. Paid plans start at $499/mo. Take the free assessment first to see your score band — no account needed.",
  tiers: [
    {
      name: "Basic",
      price: "$499",
      per: "/month",
      desc: "Start the raise and reach your matched investors yourself.",
      features: [
        "Up to 25 matched investors receive your one-pager",
        "Event spotlight in the conference reel",
        "DIY outreach — you reach investors directly",
        "All tools included: CRR, valuation, data room, e-learning, AI due diligence",
        "Fully self-serve",
      ],
      cta: { label: "Start on Basic", href: "/start?plan=basic" },
      featured: false,
    },
    {
      name: "Professional",
      price: "$1,000",
      per: "/month",
      badge: "Most founders start here",
      desc: "Actively in market and you want the stage.",
      features: [
        "Up to 100 matched investors receive your one-pager",
        "Monthly live presentation slot at the iCFO conference",
        "Brokered introduction requests",
        "Event spotlight and DIY outreach",
        "All tools included: CRR, valuation, data room, e-learning, AI due diligence",
        "Self-serve, with a call available",
      ],
      cta: { label: "Start on Professional", href: "/start?plan=professional" },
      featured: true,
    },
    {
      name: "Managed IR",
      price: "$3,500",
      per: "/month · 3-month minimum",
      badge: "Done-for-you",
      desc: "We run the outreach for you.",
      features: [
        "Everything in Professional",
        "iCFO curates your list and materials",
        "We run distribution to matched investors",
        "Post-event follow-up handled for you",
        "You review and approve — capacity-capped",
      ],
      cta: { label: "Talk to us", href: "/start?plan=managed_ir" },
      featured: false,
      contactSales: true,
    },
  ],
  investorNote:
    "Investor accounts are free. Investors are never charged, and iCapOS takes no fee from either side of an introduction.",
  billingNote:
    "Billing & refunds. A paid plan begins delivering the moment you subscribe: distribution of your materials to matched investors in the iCFO network. Because those services are rendered immediately, subscriptions are billed monthly and are non-refundable, including partial periods. Cancel any time to stop future billing; access continues through the end of the paid period.",
  comparison: {
    title: "Side by side",
    sub: "Every plan includes all tools. What changes is how many matched investors you reach — and who runs it.",
    cols: ["Basic · $499", "Professional · $1,000", "Managed IR · $3,500"],
    rows: [
      { k: "All tools (CRR, valuation, data room, e-learning, AI DD)", vals: ["Included", "Included", "Included"] },
      { k: "Matched investors your one-pager reaches", vals: ["up to 25", "up to 100", "up to 100, curated"] },
      { k: "DIY outreach", vals: ["Included", "Included", "We run it"] },
      { k: "Conference presence", vals: ["Spotlight reel", "Live presentation slot", "Live presentation slot"] },
      { k: "Brokered intro requests", vals: ["—", "Included", "Included"] },
      { k: "Distribution run for you", vals: ["—", "—", "Included"] },
      { k: "Post-event follow-up", vals: ["—", "—", "Included"] },
      { k: "Success fees or commission", vals: ["None", "None", "None"] },
    ],
    note: "“Up to” counts are real: investors set their own monthly acceptance caps, so a list can be shorter when the right-fit investors have hit their limit that month. Managed IR carries a 3-month minimum.",
  },
  crossLink: { label: "Not sure yet? See your score band free — no account needed", href: "/assessment" },
  faq: {
    eyebrow: "Questions",
    title: "Before you subscribe.",
    items: [
      { q: "Is there a free plan or free trial?", a: "No. iCapOS is investor relations — access to matched investors from iCFO Capital's network. Paid plans start at $499/mo. You can take the free assessment first to see your score band; that needs no account and grants no product access." },
      { q: "Is there a sales call?", a: "Not for Basic or Professional — those are self-serve start to finish. Managed IR is done-for-you, so it starts with a conversation. You can book a 30-minute walkthrough of the self-serve plans if you'd find it useful, but nothing requires it." },
      { q: "Why “up to” 25 and 100?", a: "Investors set their own monthly acceptance caps. When the right-fit investors for your company have hit their limit that month, your list is shorter — which is what keeps response rates from collapsing." },
      { q: "Why is every company rated first?", a: "The network takes iCFO's calls because nothing unrated goes out. The Capital Readiness Rating is investor-facing quality control — it's the reason the door opens, not a hurdle in front of it." },
      { q: "Does iCapOS make introductions?", a: "On Professional and Managed IR, iCapOS passes along brokered introduction requests and distributes your materials to matched investors. It does not recommend or vouch for anyone." },
      { q: "Do you take a percentage of what I raise?", a: "Never. The subscription is the entire commercial relationship — fixed monthly pricing, no fee contingent on a raise." },
      { q: "Can I cancel?", a: "Any time, from your account settings. Your materials stay accessible through the end of the paid period." },
    ],
  },
} as const;
