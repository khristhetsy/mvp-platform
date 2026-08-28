/**
 * Public assessment (lead magnet) copy. 10 questions → a score BAND and headline
 * only — never the full CRR, which is behind the paywall. No account is created.
 */
export const assessment = {
  eyebrow: "Free assessment",
  title: "See your score band.",
  sub: "Ten quick questions. You'll get the band your company lands in and what it means for reaching investors — no account, no card. Create a free account any time for the full per-dimension rating.",
  emailStep: {
    title: "Where should we send your band?",
    sub: "One email, no spam. We'll show your result right here.",
    emailLabel: "Work email",
    emailPlaceholder: "name@company.com",
    nameLabel: "Full name",
    companyLabel: "Company",
    submit: "See my score band",
    disclaimer:
      "By continuing you agree to our Terms and Privacy Policy. This is a directional assessment, not the full Capital Readiness Rating, and it grants no product access. iCapOS is not a broker-dealer and does not raise capital or guarantee funding.",
  },
  result: {
    scoreLabel: "Your band",
    bandNote: "This is a directional band from your answers — the full per-dimension rating is in your free account.",
    ctaFallback: "See plans",
    ctaFallbackHref: "/pricing",
    learningNote: "New to the raise? Create your free account and start with the fundamentals — every tool is free. Upgrade when you're ready to raise.",
    restart: "Retake the assessment",
  },
} as const;
