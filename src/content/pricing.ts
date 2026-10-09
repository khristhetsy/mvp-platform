/**
 * Pricing page copy (Oct 9, 2026). Founders start free: a one time AI due
 * diligence report, the Capital Readiness Rating, sharing with any investor and
 * a Private Market listing for 7,000+ investors. They upgrade when investors are
 * interested: Basic $49 and Professional $199 (card, Lemon Squeezy) or Premium
 * $1,000 (done for you, paid by bank wire). The SPV Program stays (price on
 * request, contact sales). Investors are always free.
 *
 * Every figure a visitor reads comes from the pricing catalogue (pricingFor),
 * so the page can't drift from what we charge. No dashes as sentence
 * punctuation anywhere in this copy.
 */
import { money, priceLabel, priceSublabel, type PricingCatalog } from "@/lib/subscriptions/pricing-catalog";
import { FREE_FEATURES, PREMIUM_FEATURES } from "@/lib/subscriptions/plans";

export const PRICING_DISCLAIMER =
  "iCFO Capital does not solicit securities and is not an investment adviser. Fees are flat and never tied to funding outcomes.";

const FREE_SIGNUP = "/auth/sign-up?role=founder&plan=founder_free";

export const pricing = {
  eyebrow: "Pricing",
  title: "Start free. Upgrade when investors are interested.",
  sub: "Free AI due diligence and listing in our Private Market for 7,000+ investors.",
  mainCta: { label: "Get my free report", href: FREE_SIGNUP },
  tiers: [
    {
      name: "Free",
      price: "$0",
      per: "",
      badge: "No credit card",
      // Promotional Free plan (Oct 9, 2026): amber card, top tag, urgency strip.
      promo: {
        tag: "Promotional",
        priceNote: "promotional offer",
        note: "Get your free report today. Promo will not last.",
      },
      desc: "Due diligence report, CRR, share with any investor, Private Market listing",
      features: FREE_FEATURES,
      cta: { label: "Get my free report today", href: FREE_SIGNUP },
      featured: false,
    },
    {
      name: "Basic",
      price: "$49",
      per: "/month",
      desc: "See who is interested and start reaching investors yourself.",
      features: [
        "Every tool: CRR, Due diligence report, Pitch deck analyzer, Valuation, Financial model, Cap table, Data room, Deal room, Market claim grader, Pitch practice simulator, e-learning",
        "See which investors are interested",
        "Up to 5 matched investors, identities revealed",
        "Your one-pager distributed to them",
        "Attend our Investor Conference Virtual Event",
        "DIY outreach, self-serve start to finish",
        "Up to 5 intro requests a month, through iCFO",
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
        "Up to 50 matched investors",
        "Monthly live presentation slot",
        "Up to 20 intro requests a month",
      ],
      cta: { label: "Start on Professional", href: "/start?plan=professional" },
      featured: true,
    },
    {
      name: "Premium",
      price: "$1,000",
      per: "/month",
      badge: "Done for you",
      desc: "Done for you. We do the heavy lifting so you can close the deal. Paid by wire.",
      features: PREMIUM_FEATURES,
      cta: { label: "Start on Premium", href: "/auth/sign-up?role=founder&plan=founder_premium" },
      featured: false,
    },
    {
      name: "SPV Program",
      // No listed price: discussed on the call.
      price: "Pricing on request",
      per: "",
      badge: "Done for you",
      desc: "We structure the raise through an SPV. 3 month minimum.",
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
  investorNote: "Investors join free at icapos.com/investors. Investors are never charged, and iCapOS takes no fee from either side of an introduction.",
  investorLink: { label: "icapos.com/investors", href: "/investors" },
  billingNote:
    "Billing and refunds. Basic and Professional are billed monthly by card. Premium is billed monthly ($1,000) or quarterly ($3,000) by bank wire, and activates as soon as your wire is received. A paid plan begins delivering the moment it starts, so payments are non-refundable, including partial periods. Cancel any time to stop future billing; access continues through the end of the paid period.",
  disclaimer: PRICING_DISCLAIMER,
  comparison: {
    title: "Side by side",
    sub: "Start with the free report. Upgrade to see who is interested and reach them.",
    cols: ["Free · $0", "Basic · $49", "Professional · $199", "Premium · $1,000"],
    rows: [
      { k: "AI due diligence report and Capital Readiness Rating", vals: ["One time", "Included", "Included", "Included"] },
      { k: "Share your report with any investor", vals: ["Included", "Included", "Included", "Included"] },
      { k: "Private Market listing for 7,000+ investors", vals: ["Once complete", "Included", "Included", "Included"] },
      { k: "All tools (Pitch deck analyzer, Valuation, Financial model, Cap table, Data room, Deal room, Market claim grader, Pitch practice simulator, e-learning)", vals: ["Upgrade", "Included", "Included", "Included"] },
      { k: "See which investors are interested", vals: ["Upgrade", "Included", "Included", "Included"] },
      { k: "One-pager to matched investors", vals: ["Upgrade", "up to 5", "up to 50", "up to 50"] },
      { k: "DIY outreach", vals: ["Upgrade", "Included", "Included", "Included"] },
      { k: "Investor Conference Virtual Event", vals: ["Upgrade", "Attend", "Live presentation slot", "Live presentation slot"] },
      { k: "Investor intro requests, through iCFO", vals: ["Upgrade", "up to 5 a month", "up to 20 a month", "up to 20 a month"] },
      { k: "Investor outreach run by the iCFO team", vals: ["Not included", "Not included", "Not included", "Included"] },
      { k: "How you pay", vals: ["Nothing to pay", "Card", "Card", "Bank wire"] },
      { k: "Success fees or commission", vals: ["None", "None", "None", "None"] },
    ],
    note: "SPV Program, 3 month minimum, pricing on request, is done for you: we run this raise through an SPV, structuring the vehicle and managing the outreach against your matched mandates. Talk to us.",
  },
  crossLink: { label: "Not sure which plan? See your Capital Readiness Rating first", href: "/readiness" },
  faq: {
    eyebrow: "Questions",
    title: "Before you subscribe.",
    items: [
      { q: "What do I get for free?", a: "A one time AI due diligence report and your Capital Readiness Rating, with clear steps to raise it. You can share the report with any investor. Once your listing checklist is complete, your company is listed in our Private Market for our network of 7,000+ investors. No credit card." },
      { q: "When should I upgrade?", a: "When investors are interested. A paid plan shows you who is interested and lets you reach them: Basic covers up to 5 matched investors and 5 intro requests a month; Professional up to 50 investors, 20 intro requests a month and the live stage." },
      { q: "What does Premium add?", a: "Premium is done for you. Everything in Professional, and an iCFO team member manages your investor outreach: we find your best fits in our 7,000+ investor network, make the introductions and follow up. You take the meetings and close." },
      { q: "How do I pay for Premium?", a: "By bank wire, monthly ($1,000) or quarterly ($3,000, no discount). Request a wire invoice from your billing page and we email it with wire instructions. Premium activates as soon as your wire is received, usually within 1 to 2 business days. Include the invoice number as the reference; the sender pays wire fees." },
      { q: "Is there a sales call?", a: "Not for Free, Basic, Professional or Premium. The SPV Program is done for you through an SPV, so it starts with a conversation. You can book a 30 minute walkthrough if you'd find it useful, but nothing requires it." },
      { q: "Why “up to” 5 and 50?", a: "Investors set their own monthly acceptance caps. When the right fit investors for your company have hit their limit that month, your list is shorter, which is what keeps response rates from collapsing." },
      { q: "Does iCapOS make introductions?", a: "On paid plans, you can ask iCFO to introduce you to a matched investor (5 a month on Basic, 20 on Professional and Premium). iCFO reviews each request and makes the introduction; requests it declines don't count toward your limit. It distributes your materials to matched investors; it does not recommend or vouch for anyone." },
      { q: "Do you take a percentage of what I raise?", a: "Never. Fees are flat and never tied to funding outcomes. The subscription is the entire commercial relationship." },
      { q: "Can I cancel?", a: "Any time. Your rating and materials stay accessible through the end of the paid period. Premium simply stops when you don't pay the next invoice." },
      { q: "What material do I need to have ready?", a: "Nothing. No deck, no model, no cap table, no investor list. The platform builds each of those with you. Readiness is what iCapOS produces, not what it requires. Start with whatever you have today." },
    ],
  },
} as const;

/**
 * The page copy with the ACTIVE prices laid over it. The literals above stay as
 * the fallback (and as the copy), but every figure a visitor reads comes from
 * the pricing catalogue, so the page can't drift from what we charge.
 */
export function pricingFor(catalog: PricingCatalog) {
  const free = priceLabel(catalog, "founder_free");
  const basic = priceLabel(catalog, "founder_basic");
  const pro = priceLabel(catalog, "founder_professional");
  const premium = priceLabel(catalog, "founder_premium");
  return {
    ...pricing,
    tiers: pricing.tiers.map((t) => {
      if (t.name === "Free") return { ...t, price: free };
      if (t.name === "Basic") return { ...t, price: basic, per: priceSublabel(catalog, "founder_basic") };
      if (t.name === "Professional") return { ...t, price: pro, per: priceSublabel(catalog, "founder_professional") };
      if (t.name === "Premium") return { ...t, price: premium, per: priceSublabel(catalog, "founder_premium") };
      if (t.name === "SPV Program") return { ...t, price: priceLabel(catalog, "founder_managed_ir"), per: "" };
      return t;
    }),
    comparison: {
      ...pricing.comparison,
      cols: [`Free · ${free}`, `Basic · ${basic}`, `Professional · ${pro}`, `Premium · ${premium}`],
    },
  };
}

/** One line summary used in the page description and the FAQ answer. */
export function pricingSummary(catalog: PricingCatalog) {
  return `Free ${priceLabel(catalog, "founder_free")} (AI due diligence report, CRR, share with any investor, Private Market listing), Basic ${priceLabel(catalog, "founder_basic")}/mo (all tools, up to 5 matched investors, one-pager, conference access, DIY outreach, 5 intro requests a month), Professional ${priceLabel(catalog, "founder_professional")}/mo (up to 50 matched investors, monthly live presentation slot, 20 intro requests a month), Premium ${priceLabel(catalog, "founder_premium")}/mo (done for you, paid by bank wire), SPV Program done for you with pricing on request. Additional company accounts ${money(catalog.addCompanyCents)}/mo.`;
}
