/**
 * Pure helpers for the founder investor interest page.
 */

const n = (count: number, one: string, many: string) => `${count.toLocaleString("en-US")} ${count === 1 ? one : many}`;

/** "3 investors viewed your deal, 2 requested an introduction". */
export function interestHeadline(viewed: number, requested: number): string {
  if (viewed === 0 && requested === 0) return "No investor interest yet";
  const parts: string[] = [];
  if (viewed > 0) parts.push(`${n(viewed, "investor", "investors")} viewed your deal`);
  if (requested > 0) {
    parts.push(viewed > 0 ? `${requested.toLocaleString("en-US")} requested an introduction` : `${n(requested, "investor", "investors")} requested an introduction`);
  }
  return parts.join(", ");
}

/**
 * Whole days left before an interest request expires, rounded up so a request
 * with 30 hours left reads "2 days". Null when it never expires; 0 or less
 * when it has expired.
 */
export function daysUntil(expiresAt: string | null | undefined, now: Date = new Date()): number | null {
  if (!expiresAt) return null;
  const t = new Date(expiresAt).getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - now.getTime()) / 86_400_000);
}

export function expiryLabel(expiresAt: string | null | undefined, now: Date = new Date()): string | null {
  const d = daysUntil(expiresAt, now);
  if (d === null) return null;
  if (d <= 0) return "Expired";
  return d === 1 ? "Expires in 1 day" : `Expires in ${d} days`;
}

/** First non empty string of a list-ish value (jsonb arrays come back loose). */
export function firstOf(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const v of value) if (typeof v === "string" && v.trim()) return v.trim();
    return null;
  }
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** "Angel investor · Seed" style descriptor, or null when neither is known. */
export function investorDescriptor(type: string | null, stage: string | null): string | null {
  const parts = [type, stage].filter((p): p is string => Boolean(p && p.trim()));
  return parts.length ? parts.join(" · ") : null;
}
