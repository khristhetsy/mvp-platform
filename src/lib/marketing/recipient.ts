// Contact imports often leave more than one address (or a URL) in a single email
// field, e.g. "a@x.com, b@y.com" or "a@x.com/ b@y.com". Resend rejects those outright,
// so pick the first real address instead of failing the send.
const EMAIL_RE = /^[^\s@,;/<>()"']+@[^\s@,;/<>()"']+\.[a-z]{2,}$/i;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value);
}

export function firstValidEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const parts = String(raw)
    .replace(/https?:\/\//gi, " ")
    .replace(/mailto:/gi, " ")
    .split(/[\s,;/|<>]+/);
  for (const p of parts) {
    const candidate = p.trim().replace(/^[.'"]+|[.'"]+$/g, "");
    if (isValidEmail(candidate)) return candidate.toLowerCase();
  }
  return null;
}

// Tags set by the contact email cleanup: no usable address, or every address in the
// field already belongs to another contact. These are held back from sends until a
// person fixes the record, so nobody gets a duplicate copy.
export const EMAIL_REVIEW_TAGS = ["invalid-email", "duplicate-email"] as const;

export function needsEmailReview(tags: string[] | null | undefined): boolean {
  return (tags ?? []).some((t) => (EMAIL_REVIEW_TAGS as readonly string[]).includes(t));
}
