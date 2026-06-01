import { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const VERSION_PREFIX = "int:v1:";
const KEY_SALT = "capitalos-integration-webhooks";

function integrationKey(): Buffer | null {
  const secret = process.env.TOKEN_ENCRYPTION_SECRET?.trim();
  if (!secret || secret.length < 32) return null;
  return scryptSync(secret, KEY_SALT, 32);
}

export function encryptIntegrationSecret(plaintext: string): string | null {
  const key = integrationKey();
  if (!key) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, encrypted]).toString("base64");
  return `${VERSION_PREFIX}${payload}`;
}

export function decryptIntegrationSecret(ciphertext: string): string | null {
  if (!ciphertext.startsWith(VERSION_PREFIX)) return null;
  const key = integrationKey();
  if (!key) return null;
  try {
    const raw = Buffer.from(ciphertext.slice(VERSION_PREFIX.length), "base64");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const encrypted = raw.subarray(28);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function signWebhookPayload(body: string, signingSecret: string): string {
  return createHmac("sha256", signingSecret).update(body, "utf8").digest("hex");
}

export function verifyWebhookSignature(body: string, signature: string, signingSecret: string): boolean {
  const expected = signWebhookPayload(body, signingSecret);
  try {
    return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(signature, "utf8"));
  } catch {
    return false;
  }
}

export function maskSecretHint(value: string | null): string {
  if (!value) return "Not configured";
  return `Configured (${value.length} chars, encrypted at rest)`;
}
