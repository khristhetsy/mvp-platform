/**
 * Keeps the audit honest. The model is asked for the prospect's own words, and
 * every quote it returns is checked against the thread text it was given. A
 * quote that is not in the thread is dropped, so the audit can never put words
 * in a prospect's mouth.
 */

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function verifyQuote(quote: string | null | undefined, haystack: string): boolean {
  if (!quote) return false;
  const q = normalizeText(quote).replace(/[.!?]+$/, "");
  if (q.length < 8) return false;
  return normalizeText(haystack).includes(q);
}

export type Extraction = { asked: string | null; concern: string | null };

/** Reads the model's JSON reply. Tolerates prose or code fences around it. */
export function parseExtraction(raw: string): Extraction | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const j = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
    const pick = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 300) : null);
    return { asked: pick(j.asked), concern: pick(j.concern) };
  } catch {
    return null;
  }
}

/** Keeps only the quotes that really appear in the thread. */
export function acceptQuotes(extracted: Extraction | null, haystack: string): Extraction {
  return {
    asked: extracted && verifyQuote(extracted.asked, haystack) ? extracted.asked : null,
    concern: extracted && verifyQuote(extracted.concern, haystack) ? extracted.concern : null,
  };
}
