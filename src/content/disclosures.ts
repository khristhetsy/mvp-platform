/**
 * Disclosures page copy — ported VERBATIM from icapos-site-mock.html (spec §6,
 * §13). Compliance load-bearing: flag rather than reword. Stored as a typed
 * object so copy is editable without touching JSX.
 */
export const disclosures = {
  eyebrow: "Disclosures",
  title: "What iCapOS is, and what it isn't.",
  intro:
    "iCapOS is a software product of iCFO Capital Global, Inc., a Delaware corporation. The plain-language summary below sits alongside — and does not replace — our Terms of Service and Privacy Policy.",
  blocks: [
    {
      h: "Not a regulated intermediary",
      p: "iCFO Capital Global, Inc. is not a registered broker-dealer, funding portal, investment adviser, or placement agent. It does not offer or sell securities, effect securities transactions, hold or transmit customer funds, or receive transaction-based compensation.",
    },
    {
      h: "No investment advice",
      p: "Nothing on this site or in the platform is investment, legal, tax, or accounting advice, or a recommendation to buy, sell, or hold any security. The Capital Readiness Rating and Investor Fit Score are assessment tools, not valuations, credit opinions, or predictions of outcome.",
    },
    {
      h: "No guarantee of funding",
      p: "Subscribing to iCapOS does not guarantee investor interest, meetings, or capital. Most companies that seek investment do not raise it. Any performance figures shown on this site are directionally modeled from industry benchmarks rather than measured from iCapOS cohort data, and are labeled as such where they appear.",
    },
    {
      h: "Pledge-only, no transactions",
      p: "No transactions, subscriptions, or funds are processed on the platform. Investor actions — including indications of interest, introduction requests, and syndication coordination — are non-binding and create no obligation on any party. Any resulting transaction happens directly between the parties and their own advisers, entirely off-platform.",
    },
    {
      h: "Distribution, not introduction",
      p: "Where iCapOS sends a company's materials to matched investors, it does so as a distribution service on the company's instruction. iCapOS does not introduce, endorse, vouch for, or verify any company, and does not screen companies for investment merit.",
    },
    {
      h: "Investment risk",
      p: "Private company investments are speculative, illiquid, and involve a substantial risk of total loss. They are suitable only for investors who can bear that loss and who conduct their own due diligence. Past performance is not indicative of future results.",
    },
    {
      h: "Sample data on this site",
      p: "Company names, ratings, match lists, and figures shown in interface examples across this site are illustrative and fictional. They do not represent live offerings, actual companies, or actual platform activity.",
    },
    {
      h: "Contact",
      p: "iCFO Capital Global, Inc. · La Jolla, California · legal@icapos.com",
    },
  ],
} as const;
