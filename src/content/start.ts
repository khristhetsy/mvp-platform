/**
 * Start (signup intake) copy — ported VERBATIM from icapos-site-mock.html
 * (spec §6, §13). Capital structure offers Reg D / Reg CF / Reg A+ / not sure (§8).
 */
export const start = {
  eyebrow: "Get started",
  title: "Create your account.",
  sub: "iCapOS is investor relations from iCFO Capital — access to matched investors from a 6,000+ network built over 16 years. Choose a plan from $499/mo to get in front of them. Not ready to subscribe? See your score band first — no account needed.",
  fields: {
    stage: {
      label: "Stage",
      options: ["Pre-seed", "Seed", "Series A", "Series B or later", "Not sure yet"],
    },
    raise: {
      label: "Raise target",
      options: ["Under $500K", "$500K – $2M", "$2M – $5M", "$5M+", "Still deciding"],
    },
    capital: {
      label: "Capital structure",
      options: [
        { value: "reg_d", label: "Regulation D — private placement" },
        { value: "reg_cf", label: "Regulation CF" },
        { value: "reg_a_plus", label: "Regulation A+" },
        { value: "not_sure", label: "Not sure — help me decide" },
      ],
    },
    startWith: {
      label: "Your plan",
      options: [
        { value: "rating_only", label: "Basic — $499/mo", sub: "Reach up to 25 matched investors. All tools included, DIY outreach." },
        { value: "rating_plus_plan", label: "Professional — $1,000/mo", sub: "Reach up to 100 matched investors, plus the live conference stage." },
      ],
    },
  },
  submit: "Create your account",
  signinPrompt: "Already have an account?",
  signinCta: { label: "Sign in", href: "/auth/sign-in" },
  terms: "By creating an account you agree to our Terms of Service and Privacy Policy. Creating an account does not constitute an offer to sell securities, and does not obligate you to any plan.",
  whatNext: {
    eyebrow: "What happens next",
    title: "Four steps, at your pace.",
    steps: [
      { n: "1", p: "You answer the readiness questions and upload whatever materials you have. Rough is fine." },
      { n: "2", p: "Your rating comes back with a per-dimension breakdown and an ordered fix list." },
      { n: "3", p: "Choose a plan — Basic or Professional — and your matched investor list is built against the iCFO network, ranked by fit." },
      { n: "4", p: "Distribution goes out — done for you, or sent by you from your own domain." },
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
