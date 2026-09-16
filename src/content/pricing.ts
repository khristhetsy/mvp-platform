/**
 * Pricing page copy. Model: a paid subscription unlocks the tools + investor
 * distribution — Basic $49 (all tools, up to 5, one-pager, conference access, DIY
 * outreach) → Professional $199 (up to 100, live stage, intro requests) → SPV Program
 * (done-for-you, price on request, contact sales).
 */
export const pricing = {
  eyebrow: "Pricing",
  title: "Pick the plan that fits your raise.",
  sub: "From your readiness rating to investor distribution, iCapOS runs your raise. Choose a plan to unlock the tools, reveal your matched investors, and put your materials in front of them. No success fees, no carry, no commission after an introduction.",
  tiers: [
    {
      name: "Basic",
      price: "$49",
      per: "/month",
      desc: "For founders starting the raise and building the list.",
      features: [
        "Every tool: CRR, Due diligence report, Pitch deck analyzer, Valuation, Financial model, Cap table, Data room, Deal room, Market claim grader, Pitch practice simulator, e-learning",
        "Up to 5 matched investors — identities revealed",
        "Your one-pager distributed to them",
        "Attend our Investor Conference Virtual Event",
        "DIY outreach — self-serve start to finish",
      ],
      cta: { label: "Start on Basic", href: "/start?plan=basic" },
      featured: false,
    },
    {
      name: "Professional",
      price: "$199",
      per: "/month",
      badge: "Includes stage time",
      desc: "For founders actively in market who want the stage.",
      features: [
        "Everything in Basic",
        "Up to 100 matched investors",
        "Monthly live presentation slot",
        "Investors intro requests",
      ],
      cta: { label: "Start on Professional", href: "/start?plan=professional" },
      featured: true,
    },
    {
      name: "SPV Program",
      // No listed price — discussed on the call.
      price: "Pricing on request",
      per: "",
      badge: "Done-for-you",
      desc: "We structure the raise through an SPV. 3-month minimum.",
      advisory: {
        brand: "Advisory · iCFO Capital",
        title: "Run this raise through an SPV",
        body: "One vehicle, one cap table line, one close. We structure it and manage the outreach against your matched mandates.",
      },
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
    cols: ["Basic · $49", "Professional · $199"],
    rows: [
      { k: "All tools (CRR, Due diligence report, Pitch deck analyzer, Valuation, Financial model, Cap table, Data room, Deal room, Market claim grader, Pitch practice simulator, e-learning)", vals: ["Included", "Included"] },
      { k: "See matches (count · sector · fit tier)", vals: ["Included", "Included"] },
      { k: "Investor identities revealed", vals: ["Included", "Included"] },
      { k: "One-pager to matched investors", vals: ["up to 5", "up to 100"] },
      { k: "DIY outreach", vals: ["Included", "Included"] },
      { k: "Investor Conference Virtual Event", vals: ["Attend", "Live presentation slot"] },
      { k: "Investors intro requests", vals: ["—", "Included"] },
      { k: "Success fees or commission", vals: ["None", "None"] },
    ],
    note: "SPV Program — 3-month minimum, pricing on request — is done-for-you: we run this raise through an SPV, structuring the vehicle and managing the outreach against your matched mandates. Talk to us.",
  },
  crossLink: { label: "Not sure which plan? See your Capital Readiness Rating first", href: "/readiness" },
  faq: {
    eyebrow: "Questions",
    title: "Before you subscribe.",
    items: [
      { q: "Is there a sales call?", a: "Not for Basic or Professional — those are self-serve start to finish. The SPV Program is done-for-you, so it starts with a conversation. You can book a 30-minute walkthrough of the self-serve plans if you'd find it useful, but nothing requires it." },
      { q: "What's included in a plan?", a: "Every tool — CRR, Due diligence report, Pitch deck analyzer, Valuation, Financial model, Cap table, Data room, Deal room, Market claim grader, Pitch practice simulator, e-learning — plus your matched investors are revealed and your materials are distributed to them. Basic covers up to 5 investors; Professional up to 100 and adds the live stage and intro requests." },
      { q: "Why “up to” 5 and 100?", a: "Investors set their own monthly acceptance caps. When the right-fit investors for your company have hit their limit that month, your list is shorter — which is what keeps response rates from collapsing." },
      { q: "Does iCapOS make introductions?", a: "On Professional, iCapOS passes along investor introduction requests. It distributes your materials to matched investors; it does not recommend or vouch for anyone." },
      { q: "Do you take a percentage of what I raise?", a: "Never. The subscription is the entire commercial relationship." },
      { q: "Can I cancel?", a: "Any time, from your account settings. Your rating and materials stay accessible through the end of the paid period." },
      { q: "What material do I need to have ready?", a: "Nothing. No deck, no model, no cap table, no investor list. The platform builds each of those with you — readiness is what iCapOS produces, not what it requires. Start with whatever you have today." },
    ],
  },
} as const;
