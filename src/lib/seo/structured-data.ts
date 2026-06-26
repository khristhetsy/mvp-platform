const SITE = "https://icapos.com";

export const ORGANIZATION_JSONLD: Record<string, unknown> = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "iCFO Capital Global, Inc.",
  alternateName: "CapitalOS",
  url: SITE,
  logo: `${SITE}/capitalos-logo.png`,
  description:
    "CapitalOS is an AI-powered capital readiness and private market platform for founders and investors.",
  sameAs: [],
};

export const SOFTWARE_APPLICATION_JSONLD: Record<string, unknown> = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "CapitalOS",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Capital readiness & private market platform",
  operatingSystem: "Web",
  url: SITE,
  publisher: { "@type": "Organization", name: "iCFO Capital Global, Inc." },
};

/** Visible FAQ content — reused for both the on-page block and FAQPage JSON-LD. */
export const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "What is CapitalOS?",
    a: "CapitalOS is an AI-powered capital readiness and private market platform. It scores a founder's readiness across five diligence dimensions, helps close gaps, and connects diligence-ready companies with vetted investors.",
  },
  {
    q: "Is CapitalOS a broker-dealer or investment adviser?",
    a: "No. CapitalOS is a technology and diligence platform — not a broker-dealer, placement agent, or investment adviser. Investor actions on the platform are non-binding indications of interest, not commitments or transactions.",
  },
  {
    q: "How does the founder trial work?",
    a: "Founders start with a 3-day trial that includes full Professional access and requires no credit card. After the trial, you can upgrade to Basic or Professional at any time.",
  },
  {
    q: "What do investors get?",
    a: "Investors see pre-screened, scored opportunities matched to their thesis, each with a readiness score, complete data room, and disclosure context — instead of cold inbound.",
  },
  {
    q: "Is investor interest binding?",
    a: "No. Indications of interest are non-binding informational signals. Nothing on the platform is investment advice, a recommendation, or a guarantee of funding.",
  },
];

export function faqPageJsonLd(items: { q: string; a: string }[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  };
}
