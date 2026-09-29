/**
 * At-rest cipher for social OAuth tokens (build-spec §9). Access/refresh tokens are
 * sealed with TOKEN_ENCRYPTION_SECRET (AES-256-GCM) before they touch the database
 * and opened only in server-side code that publishes.
 *
 * Standalone from the Google token-encryption module (which requires the full Google
 * OAuth env) so the queue can open tokens in a cron context without Google configured.
 *
 * Fallback: with no TOKEN_ENCRYPTION_SECRET set, tokens are stored as-is (unsealed).
 * openToken detects the version prefix, so a mix of sealed and legacy-plaintext rows
 * both read correctly — set the secret and new connects seal automatically.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const VERSION_PREFIX = "s1:";
const KEY_SALT = "icapos-social-token";

function secret(): string | null {
  return process.env.TOKEN_ENCRYPTION_SECRET?.trim() || null;
}

function key(s: string): Buffer {
  return scryptSync(s, KEY_SALT, 32);
}

/** Seal a token for storage. Returns plaintext unchanged when no secret is configured. */
export function sealToken(plaintext: string | null | undefined): string | null {
  if (!plaintext) return null;
  const s = secret();
  if (!s) return plaintext;
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key(s), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION_PREFIX}${Buffer.concat([iv, tag, encrypted]).toString("base64")}`;
}

/** Open a stored token. Passes through anything without the sealed prefix. */
export function openToken(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (!stored.startsWith(VERSION_PREFIX)) return stored; // legacy / unsealed
  const s = secret();
  if (!s) throw new Error("A sealed social token was found but TOKEN_ENCRYPTION_SECRET is not set.");
  const raw = Buffer.from(stored.slice(VERSION_PREFIX.length), "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = createDecipheriv(ALGORITHM, key(s), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function isTokenSealingActive(): boolean {
  return secret() !== null;
}
