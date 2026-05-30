import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { assertGoogleOAuthEnv } from "@/lib/integrations/google-env";

const ALGORITHM = "aes-256-gcm";
const VERSION_PREFIX = "v1:";
const KEY_SALT = "capitalos-token-encryption";

function encryptionKey() {
  const { encryptionSecret } = assertGoogleOAuthEnv();
  return scryptSync(encryptionSecret, KEY_SALT, 32);
}

export function encryptSecret(plaintext: string) {
  const key = encryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, encrypted]).toString("base64");
  return `${VERSION_PREFIX}${payload}`;
}

export function decryptSecret(ciphertext: string) {
  if (!ciphertext.startsWith(VERSION_PREFIX)) {
    throw new Error("Unsupported encrypted token format.");
  }

  const key = encryptionKey();
  const raw = Buffer.from(ciphertext.slice(VERSION_PREFIX.length), "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}
