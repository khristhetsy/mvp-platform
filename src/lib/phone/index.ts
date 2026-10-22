/**
 * Single source of truth for phone numbers across iCapOS.
 *
 *   store   -> E.164, plus " ext. N" when there is an extension ("+14255022832", "+13123461006 ext. 1")
 *   display -> national format for US/CA ("(425) 502-2832"), international for everything else
 *   dial    -> digits only, from the stored value ("tel:+14255022832")
 *
 * Numbers typed without a country code are read as US. Anything that cannot be parsed is
 * never rewritten on display: formatPhone returns the original text so no data is lost.
 */
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

export const DEFAULT_PHONE_COUNTRY: CountryCode = "US";

function parse(raw: string | null | undefined, country: CountryCode = DEFAULT_PHONE_COUNTRY) {
  const s = (raw ?? "").trim();
  if (!s) return null;
  // Accept "ext. 1", "ext 1", "x1", "#1" as an extension; libphonenumber understands "ext."
  const normalized = s.replace(/\s*(?:extension|ext\.?|x|#)\s*(\d+)\s*$/i, " ext. $1").replace(/^00/, "+");
  const p = parsePhoneNumberFromString(normalized, country);
  return p && p.isPossible() ? p : null;
}

/** True when the text is a usable phone number. */
export function isValidPhone(raw: string | null | undefined, country?: CountryCode): boolean {
  return parse(raw, country) !== null;
}

/** Value to save: E.164 (+ " ext. N"), or null when the text is empty or not a phone number. */
export function normalizePhone(raw: string | null | undefined, country?: CountryCode): string | null {
  const p = parse(raw, country);
  if (!p) return null;
  return p.ext ? `${p.number} ext. ${p.ext}` : p.number;
}

/** Human display. Unparseable text is returned as typed (trimmed), empty gives "". */
export function formatPhone(raw: string | null | undefined, country?: CountryCode): string {
  const s = (raw ?? "").trim();
  if (!s) return "";
  const p = parse(s, country);
  if (!p) return s;
  const ext = p.ext ? ` ext. ${p.ext}` : "";
  const nanp = p.countryCallingCode === "1";
  return (nanp ? p.formatNational() : p.formatInternational()).replace(/\s*ext\.?\s*\d+$/i, "") + ext;
}

/** Digits-only dial string for tel: / sms: links, or null when it is not dialable. */
export function phoneDialString(raw: string | null | undefined, country?: CountryCode): string | null {
  return parse(raw, country)?.number ?? null;
}

export function telHref(raw: string | null | undefined): string | null {
  const d = phoneDialString(raw);
  return d ? `tel:${d}` : null;
}

export function smsHref(raw: string | null | undefined): string | null {
  const d = phoneDialString(raw);
  return d ? `sms:${d}` : null;
}

/** As-you-type formatter for inputs. Keeps digits already typed, never throws. */
export function formatPhoneAsYouType(raw: string): string {
  const s = raw.replace(/[^\d+()\-.\sextEXT#]/g, "");
  if (/ext|x|#/i.test(s)) return s; // user is typing an extension, leave it alone
  const digits = s.replace(/\D/g, "");
  if (!digits) return s.startsWith("+") ? "+" : "";
  if (s.trim().startsWith("+") || s.trim().startsWith("00")) {
    const p = parsePhoneNumberFromString("+" + digits.replace(/^00/, ""));
    return p ? p.formatInternational() : "+" + digits;
  }
  const d = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (d.length > 10) return s;
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/**
 * Lenient save for server write paths (imports, forms, AI fill): E.164 when the text parses,
 * otherwise the trimmed original so no data is lost. Empty becomes null.
 */
export function phoneForStorage(raw: string | null | undefined, country?: CountryCode): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  return normalizePhone(s, country) ?? s;
}
