import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { assertGoogleOAuthEnv } from "@/lib/integrations/google-env";

const COOKIE_STATE = "google_oauth_state";
const COOKIE_RETURN = "google_oauth_return";
const MAX_AGE_SECONDS = 600;

function stateSecret() {
  return assertGoogleOAuthEnv().encryptionSecret;
}

export function createGoogleOAuthState(userId: string) {
  const nonce = randomBytes(16).toString("hex");
  const payload = `${userId}:${nonce}:${Date.now()}`;
  const signature = createHmac("sha256", stateSecret()).update(payload).digest("hex");
  return `${Buffer.from(payload).toString("base64url")}.${signature}`;
}

export function verifyGoogleOAuthState(state: string, expectedUserId: string) {
  const [encoded, signature] = state.split(".");
  if (!encoded || !signature) {
    return false;
  }

  const payload = Buffer.from(encoded, "base64url").toString("utf8");
  const expectedSignature = createHmac("sha256", stateSecret()).update(payload).digest("hex");

  const sigBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
    return false;
  }

  const [userId, , createdAtRaw] = payload.split(":");
  if (userId !== expectedUserId) {
    return false;
  }

  const createdAt = Number(createdAtRaw);
  if (!Number.isFinite(createdAt) || Date.now() - createdAt > MAX_AGE_SECONDS * 1000) {
    return false;
  }

  return true;
}

export function googleOAuthCookieOptions(maxAge = MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export { COOKIE_RETURN, COOKIE_STATE, MAX_AGE_SECONDS };
