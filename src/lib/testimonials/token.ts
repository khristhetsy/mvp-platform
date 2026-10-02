import crypto from "crypto";

/**
 * Signed per-recipient link for icapos.com/testimonial. Same scheme as the
 * unsubscribe token (base64url(email).hmac) but with its own domain prefix, so a
 * testimonial token can never be used as an unsubscribe token or the reverse.
 */
const DOMAIN = "testimonial:";

function secret(): string {
  return process.env.MARKETING_UNSUBSCRIBE_SECRET ?? "default-secret";
}

function sign(normalized: string): string {
  return crypto.createHmac("sha256", secret()).update(DOMAIN + normalized).digest("hex").slice(0, 32);
}

export function makeTestimonialToken(email: string): string {
  const normalized = email.trim().toLowerCase();
  return `${Buffer.from(normalized).toString("base64url")}.${sign(normalized)}`;
}

export function verifyTestimonialToken(token: string | null | undefined): string | null {
  if (!token || !token.includes(".")) return null;
  const [enc, sig] = token.split(".");
  if (!enc || !sig) return null;
  let email: string;
  try {
    email = Buffer.from(enc, "base64url").toString("utf8").trim().toLowerCase();
  } catch {
    return null;
  }
  if (!email.includes("@")) return null;
  const expected = sign(email);
  if (sig.length !== expected.length) return null;
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)) ? email : null;
}

export function testimonialUrl(email: string, appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com"): string {
  return `${appUrl}/testimonial?t=${makeTestimonialToken(email)}`;
}
