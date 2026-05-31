const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const URL_RE = /^https?:\/\/.+/i;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export function isValidUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (URL_RE.test(trimmed)) return true;
  try {
    const withProtocol = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
    new URL(withProtocol);
    return true;
  } catch {
    return false;
  }
}

export function parseNumeric(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

export function parseTags(value: string): string[] {
  if (!value.trim()) return [];
  return value
    .split(/[,;|]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function parseListField(value: string): string[] {
  return parseTags(value);
}

export function normalizeDomain(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    return parsed.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export function isRiskyAutoStatus(value: string): boolean {
  const lower = value.trim().toLowerCase();
  return ["approved", "published", "active", "verified"].includes(lower);
}
