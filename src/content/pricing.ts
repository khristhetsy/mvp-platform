/**
 * Pricing page copy. Model: a paid subscription unlocks the tools + investor
 * distribution — Basic $499 (all tools, up to 25, one-pager, DIY outreach,
 * spotlight) → Professional $1,000 (up to 100, live stage, brokered intros,
 * add-company $800) → Managed IR $3,500 (done-for-you, contact sales).
 */
export const pricing = {
  eyebrow: "Pricing",
  title: "Pick the plan that fits your raise.",
  sub: "From your readiness rating to investor distribution, iCapOS runs your raise. Choose a plan to unlock the tools, reveal your matched investors, and put your materials in front of them. No success fees, no carry, no commission after an introduction.",
  tiers: [
    {
      name: "Basic",
      price: "$499",
      per: "/month",
      desc: "For founders starting the raise and building the list.",
      features: [
        "Every tool: CRR, valuation, data room, e-learning",
        "Up to 25 matched investors — identities revealed",
        "Your one-pager distributed to them",
        "Event spotlight in the conference reel",
        "DIY outreach — self-serve start to finish",
      ],
      cta: { label: "Start on Basic", href: "/start?plan=basic" },
      featured: false,
    },
    {
      name: "Professional",
      price: "$1,000",
      per: "/month",
      badge: "Includes stage time",
      desc: "For founders actively in market who want the stage.",
      features: [
        "Everything in Basic",
        "Up to 100 matched investors",
        "Monthly live presentation slot",
        "Brokered intro requests",
        "Additional company accounts $800/mo",
      ],
      cta: { label: "Start on Professional", href: "/start?plan=professional" },
      featured: true,
    },
    {
      name: "Managed IR",
      price: "$3,500",
      per: "/month",
      badge: "Done-for-you",
      desc: "We run the raise for you. 3-month minimum.",
      features: [
        "Everything in Professional, uncapped",
        "We curate the list and your materials",
        "You review and approve",
        "Post-conference follow-up run for you",
        "Capacity-capped — talk to us",
      ],
      cta: { label: "Talk to us", href: "/schedule/dc2f3667-ca80-4f35-a1cd-ba0c3adac510" },
      featured: false,
      contactSales: true,
    },
  ],
  investorNote:
    "Investor accounts are free. Investors are never charged, and iCapOS takes no fee from either side of an introduction.",
  billingNote:
    "Billing & refunds. A paid plan begins delivering the moment you subscribe: the tools unlock and your materials are distributed to matched investors in the iCFO network. Because those services are rendered immediately, subscriptions are billed monthly and are non-refundable, including partial periods. Cancel any time to stop future billing; access continues through the end of the paid period.",
  comparison: {
    title: "Side by side",
    sub: "One subscription unlocks the tools and your investor distribution.",
    cols: ["Basic · $499", "Professional · $1,000"],
    rows: [
      { k: "All tools (CRR, valuation, data room, e-learning)", vals: ["Included", "Included"] },
      { k: "See matches (count · sector · fit tier)", vals: ["Included", "Included"] },
      { k: "Investor identities revealed", vals: ["Included", "Included"] },
      { k: "One-pager to matched investors", vals: ["up to 25", "up to 100"] },
      { k: "DIY outreach", vals: ["Included", "Included"] },
      { k: "Conference presence", vals: ["Spotlight reel", "Live presentation slot"] },
      { k: "Brokered intro requests", vals: ["—", "Included"] },
      { k: "Additional company accounts", vals: ["—", "$800/mo"] },
      { k: "Success fees or commission", vals: ["None", "None"] },
    ],
    note: "Managed IR — $3,500/mo, 3-month minimum — is done-for-you: we curate the list and materials, you approve, we run follow-up. Talk to us.",
  },
  crossLink: { label: "Not sure which plan? See your Capital Readiness Rating first", href: "/readiness" },
  faq: {
    eyebrow: "Questions",
    title: "Before you subscribe.",
    items: [
      { q: "Is there a sales call?", a: "Not for Basic or Professional — those are self-serve start to finish. Managed IR is done-for-you, so it starts with a conversation. You can book a 30-minute walkthrough of the self-serve plans if you'd find it useful, but nothing requires it." },
      { q: "What's included in a plan?", a: "Every tool — Capital Readiness Rating, valuation, the data room, and e-learning — plus your matched investors are revealed and your materials are distributed to them. Basic covers up to 25 investors; Professional up to 100 and adds the live stage and brokered intros." },
      { q: "Why “up to” 25 and 100?", a: "Investors set their own monthly acceptance caps. When the right-fit investors for your company have hit their limit that month, your list is shorter — which is what keeps response rates from collapsing." },
      { q: "Does iCapOS make introductions?", a: "On Professional, iCapOS passes along brokered introduction requests. It distributes your materials to matched investors; it does not recommend or vouch for anyone." },
      { q: "Do you take a percentage of what I raise?", a: "Never. The subscription is the entire commercial relationship." },
      { q: "Can I cancel?", a: "Any time, from your account settings. Your rating and materials stay accessible through the end of the paid period." },
      { q: "What material do I need to have ready?", a: "Nothing. No deck, no model, no cap table, no investor list. The platform builds each of those with you — readiness is what iCapOS produces, not what it requires. Start with whatever you have today." },
    ],
  },
} as const;
