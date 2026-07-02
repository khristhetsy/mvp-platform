// JSON-LD generation from the AEO record. Because both the schema and the visible
// HTML come from the same record, they match exactly (Google penalizes mismatches).

import type { AeoPage } from "./types";

const SITE = "https://icapos.com";

export function buildJsonLd(p: AeoPage): Record<string, unknown> {
  const url = `${SITE}/learn/${p.slug}`;
  const graph: Record<string, unknown>[] = [
    {
      "@type": "Article",
      headline: p.h1,
      description: p.metaDescription,
      about: p.definedTerm,
      articleBody: p.definitionAnswer,
      url,
      ...(p.publishedAt ? { datePublished: p.publishedAt } : {}),
      dateModified: p.updatedAt,
      publisher: { "@type": "Organization", name: "iCapOS", url: SITE },
    },
    {
      "@type": "FAQPage",
      mainEntity: p.faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  if (p.definedTerm) {
    graph.push({
      "@type": "DefinedTerm",
      name: p.definedTerm,
      description: p.definitionAnswer,
      inDefinedTermSet: `${SITE}/learn`,
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
}
