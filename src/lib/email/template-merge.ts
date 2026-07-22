// Slot merge for the live preview and the send layer (build spec §5, §6).
//
// Takes a master's compiled_html and a copy's slot_values and replaces each
// `{{key}}` token. Text/textarea/url slots are HTML-escaped to prevent injected
// markup; image/url values are additionally URL-sanitised. Unresolved tokens are
// left for the send layer (per-recipient tokens like {{unsubscribe_url}}) or
// blanked, never rendered as literal braces to the recipient.

import type { PlaceholderSchema, SlotType } from "./template-schema";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Only http(s) URLs survive; anything else (javascript:, data:) becomes "#". */
function safeUrl(value: string): string {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : "#";
  } catch {
    return "#";
  }
}

function renderSlotValue(raw: string, type: SlotType): string {
  const value = (raw ?? "").trim();
  if (!value) return "";
  if (type === "url" || type === "image") return escapeHtml(safeUrl(value));
  return escapeHtml(value);
}

export type MergeOptions = {
  /** Leave these tokens untouched for the send layer to fill per-recipient. */
  preserveTokens?: readonly string[];
};

/**
 * Merge slot values into compiled HTML. `schema` gives each slot its type so the
 * right escaping is applied. Tokens in `preserveTokens` are passed through
 * unchanged; any other unresolved token is replaced with an empty string so the
 * recipient never sees raw `{{braces}}`.
 */
export function mergeSlots(
  compiledHtml: string,
  slotValues: Record<string, string>,
  schema: PlaceholderSchema,
  options: MergeOptions = {},
): string {
  const typeByKey = new Map<string, SlotType>(schema.slots.map((s) => [s.key.toLowerCase(), s.type]));
  const preserve = new Set((options.preserveTokens ?? []).map((t) => t.toLowerCase()));

  return compiledHtml.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_m, rawKey: string) => {
    const key = rawKey.toLowerCase();
    if (preserve.has(key)) return `{{${key}}}`;
    if (key in slotValues || typeByKey.has(key)) {
      return renderSlotValue(slotValues[key] ?? "", typeByKey.get(key) ?? "text");
    }
    // Unknown, non-preserved token → blank rather than literal braces.
    return "";
  });
}
