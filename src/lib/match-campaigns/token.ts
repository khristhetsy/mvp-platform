/**
 * Signed, login-free tokens for a campaign founder row. Links in the Match email carry
 * one so clicks and page opens are attributed without a session. HMAC over the row id;
 * nothing secret or personal is in the payload.
 */
import crypto from "crypto";

function secret(): string {
  return process.env.MATCH_CAMPAIGN_SECRET ?? process.env.MARKETING_UNSUBSCRIBE_SECRET ?? "default-secret";
}

function sign(id: string): string {
  return crypto.createHmac("sha256", secret()).update(`mc:${id}`).digest("base64url").slice(0, 22);
}

export function makeMatchToken(campaignFounderId: string): string {
  return `${Buffer.from(campaignFounderId).toString("base64url")}.${sign(campaignFounderId)}`;
}

export function verifyMatchToken(token: string | null | undefined): string | null {
  const [enc, sig] = String(token ?? "").split(".");
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
