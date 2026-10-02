/** Pure validation for a founder testimonial submission (shared by form and API). */

export const QUOTE_MIN = 20;
export const QUOTE_MAX = 600;
export const TITLE_MAX = 80;

export type TestimonialInput = {
  token: string;
  quote: string;
  title?: string;
  anonymous: boolean;
  showScore: boolean;
  consent: boolean;
};

export type ValidationResult =
  | { ok: true; value: TestimonialInput }
  | { ok: false; errors: Partial<Record<"quote" | "title" | "consent" | "token", string>> };

export function validateTestimonial(raw: unknown): ValidationResult {
  const r = (raw ?? {}) as Record<string, unknown>;
  const errors: Partial<Record<"quote" | "title" | "consent" | "token", string>> = {};
  const token = typeof r.token === "string" ? r.token.trim() : "";
  const quote = typeof r.quote === "string" ? r.quote.replace(/\s+/g, " ").trim() : "";
  const title = typeof r.title === "string" ? r.title.trim() : "";
  if (!token) errors.token = "This link is missing its code. Use the button in your email.";
  if (quote.length < QUOTE_MIN) errors.quote = `Write at least ${QUOTE_MIN} characters.`;
  else if (quote.length > QUOTE_MAX) errors.quote = `Keep it under ${QUOTE_MAX} characters.`;
  if (title.length > TITLE_MAX) errors.title = `Keep your title under ${TITLE_MAX} characters.`;
  if (r.consent !== true) errors.consent = "Tick the box to agree we may publish it.";
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: { token, quote, title: title || undefined, anonymous: r.anonymous === true, showScore: r.showScore !== false, consent: true },
  };
}
