/**
 * Start (signup intake) copy — ported VERBATIM from icapos-site-mock.html
 * (spec §6, §13). Capital structure offers Reg D / Reg CF / Reg A+ / not sure (§8).
 */
export const start = {
  eyebrow: "Get started",
  title: "Create your account.",
  sub: "Start with a free AI due diligence report, or choose Basic or Professional to unlock the tools and reach your matched investors.",
  fields: {
    stage: {
      label: "Stage",
      options: ["Pre-seed", "Seed", "Series A", "Series B or later", "Not sure yet"],
    },
    raise: {
      label: "Raise target",
      options: ["Under $500K", "$500K to $2M", "$2M to $5M", "$5M+", "Still deciding"],
    },
    capital: {
      label: "Capital structure",
      options: [
        { value: "reg_d", label: "Regulation D, private placement" },
        { value: "reg_cf", label: "Regulation CF" },
        { value: "reg_a_plus", label: "Regulation A+" },
        { value: "not_sure", label: "Not sure, help me decide" },
      ],
    },
    // Free due diligence is back (Oct 9, 2026) and is the first founder
    // option; paid plans pay at checkout. Prices come from the live pricing set.
    plan: {
      label: "Your plan",
      options: [
        {
          value: "founder_free",
          label: "Free due diligence",
          features: ["AI due diligence report", "Capital Readiness Rating", "Share with any investor", "Private Market listing"],
        },
        {
          value: "founder_basic",
          label: "Basic",
          features: ["All tools: CRR, valuation, data room, e-learning", "Up to 5 matched investors get your one-pager", "Up to 5 intro requests a month", "Investor Conference virtual event"],
        },
        {
          value: "founder_professional",
          label: "Professional",
          features: ["Everything in Basic", "Monthly presentation slot", "Up to 20 intro requests a month"],
        },
      ],
    },
  },
  submit: "Create account, continue with",
  signinPrompt: "Already have an account?",
  signinCta: { label: "Sign in", href: "/auth/sign-in" },
  terms: "By creating an account you agree to our Terms of Service and Privacy Policy. Creating an account does not constitute an offer to sell securities. Free needs no card; for a paid plan you confirm and pay at checkout. iCFO Capital does not solicit securities and is not an investment adviser. Content is for educational purposes only.",
  whatNext: {
    eyebrow: "What happens next",
    title: "Four steps, at your pace.",
    steps: [
      { n: "1", p: "Choose your plan and create your account. Free needs no card; paid plans pay at checkout." },
      { n: "2", p: "You answer the readiness questions and upload whatever materials you have. Rough is fine." },
      { n: "3", p: "Your rating comes back with a per-dimension breakdown and an ordered fix list, and your matched investor list is built against the network." },
      { n: "4", p: "Distribution goes out, done for you or sent by you from your own domain." },
    ],
  },
  yourData: {
    eyebrow: "Your data",
    title: "Private by default.",
    points: [
      "Your rating is never published or shared without your say-so",
      "Contact details unlock only when you accept an introduction request",
      "Data room access is logged and watermarked on every view",
      "We never resell founder or investor data",
    ],
  },
} as const;
