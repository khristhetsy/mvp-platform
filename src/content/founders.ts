/**
 * Founders page copy — ported VERBATIM from icapos-site-mock.html (spec §6, §13).
 * Section order (§6): hero → what you get → the heavy-lifting split → "Nothing."
 * → done-for-you vs DIY → AI drafting → closing CTA. Compliance load-bearing.
 */
export const founders = {
  hero: {
    eyebrow: "For founders",
    title: "Get in front of matched investors — run it yourself, or we run it for you.",
    sub: "iCapOS is investor relations from iCFO Capital. We put your company in front of matched investors from a 6,000+ network built over 16 years. Every company is rated first — that's why the network opens. Run the outreach yourself, or we run it for you.",
    primaryCta: { label: "See your score band", href: "/assessment" },
    secondaryCta: { label: "Compare plans", href: "/pricing" },
  },

  whatYouGet: {
    eyebrow: "What you get",
    title: "Four things, running every month.",
    items: [
      { h: "A matched investor list", p: "Your company profile is scored against investor mandates — sector, stage, check size, geography — and ranked by Investor Fit Score. You see every name and the reason it matched." },
      { h: "Distribution, done for you", p: "We send your one-pager or investor newsletter to the matched list on your behalf. Responses go directly to your inbox — iCapOS never sits between you and an interested investor." },
      { h: "The conference stage", p: "Professional-plan founders get a live presentation slot at the monthly iCFO Investment Conference. Basic-plan founders are spotlighted in the 60-second pitch reel broadcast to the network." },
      { h: "The full toolset", p: "Readiness rating and re-scoring, investor CRM, data room, materials builder, campaign tracking and the AI assistant — all included in every plan. Plans differ by how many matched investors you reach and who runs the outreach, not by which tools you get." },
    ],
  },

  heavyLifting: {
    eyebrow: "The heavy lifting",
    title: "You run the company. We run the outreach.",
    intro: "Fundraising eats a founder's calendar because almost all of it is repetitive work that isn't running the business. Here's the actual split.",
    doesTitle: "iCapOS does this",
    doesSub: "All of it, every month",
    does: [
      "Scores your readiness and tells you what to fix, in order",
      "Drafts the one-pager and investor summary from what you say",
      "Builds the matched investor list against live mandate criteria",
      "Checks each investor's monthly cap before anything is sent",
      "Sends your materials and sequences the follow-up",
      "Tracks delivery, opens and replies in one dashboard",
      "Puts you on the conference agenda or into the pitch reel",
    ],
    youTitle: "You do this",
    youSub: "Three things",
    you: [
      "Answer honestly about where the business actually is",
      "Approve what goes out with your name on it",
      "Take the conversations that come back",
    ],
    note: "That's the whole ask. No list-building, no mail-merge, no chasing, no working out who to contact in what order — and no calls with us to make any of it happen.",
    cta: { label: "See your score band", href: "/assessment" },
  },

  nothing: {
    eyebrow: "What you need to get started",
    big: "Nothing.",
    paras: [
      "Every other platform hands you a checklist before it will help. That's backwards — if you already had a polished deck, a three-statement model and a clean cap table, you wouldn't need much from us.",
      "Readiness is what iCapOS produces. Turn up with a half-finished deck, a spreadsheet, or just a clear head about what you're building, and we take it from there.",
    ],
    cta: { label: "See your score band", href: "/assessment" },
    items: [
      { h: "A pitch deck", p: "Not required. Tell us what the business does and the platform drafts an investor-ready summary you edit, not a blank page you stare at." },
      { h: "A financial model", p: "Not required. The rating shows you exactly which assumptions investors will push on, and the templates are built into the platform." },
      { h: "A clean cap table", p: "Not required. If prior notes or SAFEs have never been modelled, that shows up as a scored gap with the fix spelled out." },
      { h: "An investor list", p: "Not required — that's the product. Matching builds it against mandates in the iCFO network." },
      { h: "A one-pager", p: "Not required. Drafted from what you tell us, in the structure investors actually read." },
      { h: "A data room", p: "Not required. One is created for you, with watermarking and access logs, when you're ready to share." },
    ],
    needNote: "The one thing we do need. Straight answers. The rating is only useful if you describe the business as it actually is today — an inflated number in, an inflated rating out, and the gap shows up in front of an investor instead of in front of us.",
  },

  twoWays: {
    eyebrow: "Two ways to send",
    title: "DIY is a switch, not a downgrade.",
    dfy: {
      h: "Done for you",
      p: "iCapOS sends your one-pager or investor newsletter to the matched list on your behalf, on a cadence each investor has already agreed to accept. Replies land in your inbox — we never sit between you and an interested investor.",
      points: [
        "Nothing to schedule, nothing to write twice",
        "Sending respects every investor's monthly cap automatically",
        "Delivery and reply activity tracked in your dashboard",
      ],
    },
    diy: {
      h: "Send it yourself",
      p: "Some founders want their own name in the “from” field. Flip to DIY and you send through the same matched list and the same volume caps — the platform builds and sequences it, you press send.",
      points: [
        "Same matching engine, same fit scores, same caps",
        "Sends from your own domain and signature",
        "Switch between DIY and done-for-you at any time",
      ],
    },
    capTitle: "What “up to 25” actually means",
    capParas: [
      "Every investor sets their own monthly limit on how many companies they'll accept. When the right-fit investors for your company have already hit their cap that month, your list is shorter — and that's deliberate.",
      "Capping volume is what keeps the network responsive. A short list of investors who opted in beats a long list of investors who've stopped reading.",
      "So we say “up to.” 25 matched investors on Basic, 100 on Professional — as availability allows.",
    ],
  },

  drafting: {
    eyebrow: "AI drafting",
    title: "The investor one-pager, written for you.",
    sub: "Distribution only works if the thing being distributed is good. Paste what your company does and get back an investor-ready summary in the structure investors actually read.",
    cta: "Draft my summary",
    disclaimer: "AI-generated draft based only on what you provide. Review and verify every figure before sending anything to an investor.",
  },

  closing: {
    title: "More meetings, faster, with fewer diligence deaths.",
    sub: "That's the claim. Not “you'll raise” — nobody can promise that. See your score band and where you stand with matched investors.",
    primaryCta: { label: "See your score band", href: "/assessment" },
    secondaryCta: { label: "See pricing", href: "/pricing" },
    // Required cross-link (§3): Founders → Events, in the closing CTA.
    eventsCta: { label: "See the iCFO events", href: "/events" },
  },
} as const;
