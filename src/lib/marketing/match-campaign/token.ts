/**
 * Signed link token for one founder in one Match campaign. Carries the
 * match_campaign_founders row id and an HMAC, so clicks are attributed without
 * a login and a token can't be guessed or altered to read another founder's
 * matches. Server only.
 */
import crypto from "crypto";

function secret(): string {
  return process.env.MATCH_CAMPAIGN_TOKEN_SECRET || process.env.MARKETING_UNSUBSCRIBE_SECRET || "default-secret";
}

function sign(id: string): string {
  return crypto.createHmac("sha256", secret()).update(`match-campaign:${id}`).digest("base64url").slice(0, 32);
}

export function makeFounderToken(campaignFounderId: string): string {
  return `${Buffer.from(campaignFounderId).toString("base64url")}.${sign(campaignFounderId)}`;
}

/** Returns the match_campaign_founders id, or null when the token is not valid. */
export function verifyFounderToken(token: string | null | undefined): string | null {
  if (!token || typeof token !== "string") return null;
  const [enc, sig] = token.split(".");
  if (!enc || !sig) return null;
  let id: string;
  try {
    id = Buffer.from(enc, "base64url").toString("utf8");
  } catch {
    return null;
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const expected = sign(id);
  if (sig.length !== expected.length) return null;
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)) ? id : null;
}
