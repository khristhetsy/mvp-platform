// AEO page: one structured record drives both the rendered HTML and the JSON-LD,
// so schema can never drift from visible content.

export interface AeoSection {
  id: string;
  heading: string;
  body: string; // self-contained passage
}

export interface FaqItem {
  q: string;
  a: string; // engagement-register only
}

export type AeoStatus = "draft" | "in_review" | "published";
export type ComplianceStatus = "unreviewed" | "cleared" | "flagged";

export interface AeoPage {
  id: string;
  slug: string;
  status: AeoStatus;
  eyebrow: string;
  h1: string;
  lede: string;
  definitionAnswer: string; // THE citable answer block — liftable, self-contained
  definedTerm?: string;
  sections: AeoSection[];
  faq: FaqItem[];
  metaDescription: string;
  complianceStatus: ComplianceStatus;
  publishedAt?: string;
  updatedAt: string;
}

/** DB row shape (snake_case) → domain object. */
export interface AeoPageRow {
  id: string;
  slug: string;
  status: AeoStatus;
  eyebrow: string | null;
  h1: string;
  lede: string | null;
  definition_answer: string;
  defined_term: string | null;
  sections: AeoSection[] | null;
  faq: FaqItem[] | null;
  meta_description: string | null;
  compliance_status: ComplianceStatus;
  published_at: string | null;
  updated_at: string;
}

export function rowToPage(r: AeoPageRow): AeoPage {
  return {
    id: r.id,
    slug: r.slug,
    status: r.status,
    eyebrow: r.eyebrow ?? "",
    h1: r.h1,
    lede: r.lede ?? "",
    definitionAnswer: r.definition_answer,
    definedTerm: r.defined_term ?? undefined,
    sections: Array.isArray(r.sections) ? r.sections : [],
    faq: Array.isArray(r.faq) ? r.faq : [],
    metaDescription: r.meta_description ?? "",
    complianceStatus: r.compliance_status,
    publishedAt: r.published_at ?? undefined,
    updatedAt: r.updated_at,
  };
}

/** The fixed advisory-only line shown on every public AEO page (never a merge field). */
export const AEO_COMPLIANCE_FOOTER =
  "iCapOS provides software and educational information only. Nothing on this page is investment, legal, tax, or financial advice, an offer or solicitation to buy or sell any security, or a recommendation of any investment. Any investment decision is made independently by investors based on their own diligence.";
