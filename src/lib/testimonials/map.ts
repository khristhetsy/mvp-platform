import type { FounderResult } from "@/content/founder-results";

/** A founder_testimonials row as stored. */
export type TestimonialRow = {
  id: string;
  email: string;
  name: string;
  title: string | null;
  company_name: string | null;
  industry: string | null;
  stage: string | null;
  quote: string;
  anonymous: boolean;
  show_score: boolean;
  crr_start: number | null;
  crr_current: number | null;
  consent_at: string;
  status: "pending" | "approved" | "declined";
  reviewed_at: string | null;
  created_at: string;
};

/** Approved row → the homepage card shape. Honors the founder's display choices. */
export function rowToFounderResult(r: TestimonialRow): FounderResult {
  const score = r.show_score && r.crr_start != null && r.crr_current != null;
  return {
    quote: r.quote,
    approvedOn: (r.reviewed_at ?? r.consent_at).slice(0, 10),
    anonymous: r.anonymous,
    name: r.anonymous ? undefined : r.name,
    title: r.anonymous ? undefined : r.title ?? undefined,
    company: r.anonymous ? undefined : r.company_name ?? undefined,
    industry: r.industry ?? undefined,
    stage: r.stage ?? undefined,
    crrStart: score ? r.crr_start! : undefined,
    crrCurrent: score ? r.crr_current! : undefined,
  };
}
