/**
 * Pricing page copy — ported VERBATIM from icapos-site-mock.html (spec §6, §13).
 * Figures load-bearing (§6): Basic $499 / up to 25 / spotlight reel; Professional
 * $1,000 / up to 100 / live slot; both include the full toolset; investors free.
 */
export const pricing = {
  eyebrow: "Pricing",
  title: "Two plans. Every tool in both.",
  sub: "Flat monthly subscription. No success fees, no carry, no commission on anything that happens after an introduction. Self-serve checkout, cancel any time.",
  tiers: [
    {
      name: "Founder Basic",
      price: "$499",
      per: "/month",
      desc: "For founders starting the raise and building the list.",
      features: [
        "Up to 25 matched investors per month",
        "Done-for-you distribution or DIY sending",
        "Spotlight in the conference pitch reel",
        "Capital Readiness Rating and re-scoring",
        "Full iCapOS toolset — nothing withheld",
      ],
      cta: { label: "Start on Basic", href: "/start?plan=basic" },
      featured: false,
    },
    {
      name: "Founder Professional",
      price: "$1,000",
      per: "/month",
      badge: "Includes stage time",
      desc: "For founders actively in market who want the stage.",
      features: [
        "Up to 100 matched investors per month",
        "Done-for-you distribution or DIY sending",
        "Live presentation slot at the monthly conference",
        "Capital Readiness Rating and re-scoring",
        "Full iCapOS toolset — nothing withheld",
      ],
      cta: { label: "Start on Professional", href: "/start?plan=professional" },
      featured: true,
    },
  ],
  investorNote:
    "Investor accounts are free. Investors are never charged, and iCapOS takes no fee from either side of an introduction.",
  billingNote:
    "Billing & refunds. Your plan begins delivering the moment you subscribe — AI due diligence reporting and updates, and distribution of your materials to matched investors in the iCFO network. Because these services are rendered immediately, subscriptions are billed monthly and are non-refundable, including partial periods. Cancel any time to stop future billing; access continues through the end of the paid period. The free Capital Readiness Rating lets you see how iCapOS works before you pay.",
  comparison: {
    title: "Side by side",
    sub: "The only difference is reach and stage time.",
    cols: ["Basic · $499", "Professional · $1,000"],
    rows: [
      { k: "Matched investors per month", a: "up to 25", b: "up to 100" },
      { k: "Conference presence", a: "Spotlight reel", b: "Live presentation slot" },
      { k: "Done-for-you distribution", a: "Included", b: "Included" },
      { k: "DIY outreach mode", a: "Included", b: "Included" },
      { k: "Readiness Rating & re-scoring", a: "Included", b: "Included" },
      { k: "Investor CRM, data room, AI assistant", a: "Included", b: "Included" },
      { k: "Success fees or commission", a: "None", b: "None" },
    ],
  },
  crossLink: { label: "Not sure which plan? Start with the free rating", href: "/readiness" },
  faq: {
    eyebrow: "Questions",
    title: "Before you subscribe.",
    items: [
      { q: "Is there a sales call?", a: "No. Both plans are self-serve start to finish. You can book a 30-minute walkthrough if you'd find it useful, but nothing requires it and you can subscribe without ever speaking to anyone." },
      { q: "Why “up to” 25 and 100?", a: "Investors set their own monthly acceptance caps. When the right-fit investors for your company have hit their limit that month, your list is shorter — which is what keeps response rates from collapsing." },
      { q: "Does iCapOS make introductions?", a: "No. iCapOS distributes your materials to matched investors and passes along introduction requests. It does not introduce, recommend, or vouch for anyone." },
      { q: "Do you take a percentage of what I raise?", a: "Never. The subscription is the entire commercial relationship." },
      { q: "Can I cancel?", a: "Any time, from your account settings. Your rating and materials stay accessible through the end of the paid period." },
      { q: "Can I get a refund?", a: "Subscriptions are non-refundable. Your plan starts delivering the moment you subscribe — AI due diligence reporting and updates, and distribution of your materials to matched investors — so the services are rendered immediately. You can cancel any time to stop future charges, and access continues through the end of the paid period. The Capital Readiness Rating is free, so you can see how iCapOS works before you pay." },
      { q: "What material do I need to have ready?", a: "Nothing. No deck, no model, no cap table, no investor list. The platform builds each of those with you — readiness is what iCapOS produces, not what it requires. Run the free rating with whatever you have today." },
    ],
  },
} as const;
