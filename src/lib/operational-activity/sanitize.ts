const SENSITIVE_METADATA_KEYS = [
  "password",
  "token",
  "oauth",
  "refresh_token",
  "access_token",
  "google_token",
  "service_role",
  "secret",
  "file_path",
  "file_url",
  "body",
  "message_body",
  "message",
  "internal_notes",
  "encrypted",
];

const MAX_METADATA_STRING = 500;
const MAX_DESCRIPTION = 1000;

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_METADATA_KEYS.some((part) => lower.includes(part));
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (value == null) return value;
  if (typeof value === "string") {
    if (value.startsWith("storage/")) return undefined;
    return value.length > MAX_METADATA_STRING ? `${value.slice(0, MAX_METADATA_STRING)}…` : value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeValue(item, depth + 1));
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(record)) {
      if (isSensitiveKey(key)) continue;
      const cleaned = sanitizeValue(nested, depth + 1);
      if (cleaned !== undefined) sanitized[key] = cleaned;
    }
    return sanitized;
  }
  return value;
}

export function sanitizeOperationalMetadata(metadata: Record<string, unknown> | undefined) {
  if (!metadata) return {};
  return sanitizeValue(metadata) as Record<string, unknown>;
}

export function sanitizeOperationalDescription(description: string | null | undefined) {
  if (!description?.trim()) return null;
  const trimmed = description.trim();
  return trimmed.length > MAX_DESCRIPTION ? `${trimmed.slice(0, MAX_DESCRIPTION)}…` : trimmed;
}
