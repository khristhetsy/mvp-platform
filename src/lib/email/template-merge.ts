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

/** Escape, then turn **bold** into <b>. Only ever applied to escaped text. */
function inlineFormat(value: string): string {
  return escapeHtml(value).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
}

const P_STYLE = "margin:0 0 14px 0;";
const LI_STYLE = "margin:0 0 8px 0;";
const TILE_LABEL = "font-size:12px;color:#5A6B8C;line-height:1.4;";
const TILE_VALUE = "font-size:17px;font-weight:bold;color:#0A1A40;line-height:1.3;";

/** Blank line = new paragraph, single newline = line break, **bold** allowed. */
function renderRichText(value: string): string {
  return value
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="${P_STYLE}">${p.split("\n").map(inlineFormat).join("<br />")}</p>`)
    .join("");
}

/** One bullet per non-empty line; leading "-", "*" or "•" markers are dropped. */
function renderList(value: string): string {
  const items = value
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[-*•]\s+)/, "").trim())
    .filter(Boolean);
  if (items.length === 0) return "";
  return `<ul style="margin:0;padding:0 0 0 20px;list-style-type:disc;">${items.map((i) => `<li style="${LI_STYLE}">${inlineFormat(i)}</li>`).join("")}</ul>`;
}

/** "Label: value" per line → a 3-across grid of tiles (email-safe table). */
function renderTerms(value: string): string {
  const pairs = value
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf(":");
      return i === -1 ? { label: l, val: "" } : { label: l.slice(0, i).trim(), val: l.slice(i + 1).trim() };
    });
  if (pairs.length === 0) return "";
  const rows: string[] = [];
  for (let i = 0; i < pairs.length; i += 3) {
    const cells = pairs.slice(i, i + 3).map(
      (p) =>
        `<td width="33%" valign="top" style="padding:4px;"><div style="background:#F6F8FC;border-radius:8px;padding:10px 12px;"><div style="${TILE_LABEL}">${escapeHtml(p.label)}</div><div style="${TILE_VALUE}">${escapeHtml(p.val)}</div></div></td>`,
    );
    while (cells.length < 3) cells.push('<td width="33%" style="padding:4px;"></td>');
    rows.push(`<tr>${cells.join("")}</tr>`);
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;margin:0 -4px;">${rows.join("")}</table>`;
}

export function renderSlotValue(raw: string, type: SlotType): string {
  const value = (raw ?? "").trim();
  if (!value) return "";
  if (type === "url" || type === "image") return escapeHtml(safeUrl(value));
  if (type === "richtext") return renderRichText(value);
  if (type === "list") return renderList(value);
  if (type === "terms") return renderTerms(value);
  return escapeHtml(value);
}

/**
 * Optional blocks: `<!--if:key-->…<!--endif:key-->` is kept when `key` has a
 * value (or is a preserved send-time token) and removed when it is empty, so
 * a master can hide e.g. the sender photo or bio when they aren't filled in.
 * The markers themselves are always stripped.
 */
function resolveConditionals(html: string, slotValues: Record<string, string>, preserve: Set<string>): string {
  // Repeat so blocks nested inside other blocks are resolved too.
  let out = html;
  for (let i = 0; i < 5; i++) {
    const next = resolveOnce(out, slotValues, preserve);
    if (next === out) break;
    out = next;
  }
  return out;
}

function resolveOnce(html: string, slotValues: Record<string, string>, preserve: Set<string>): string {
  return html.replace(/<!--\s*if:([a-z0-9_]+)\s*-->([\s\S]*?)<!--\s*endif:\1\s*-->/gi, (_m, rawKey: string, inner: string) => {
    const key = rawKey.toLowerCase();
    if (preserve.has(key)) return inner;
    return (slotValues[key] ?? "").trim() ? inner : "";
  });
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

  return resolveConditionals(compiledHtml, slotValues, preserve).replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_m, rawKey: string) => {
    const key = rawKey.toLowerCase();
    if (preserve.has(key)) return `{{${key}}}`;
    if (key in slotValues || typeByKey.has(key)) {
      return renderSlotValue(slotValues[key] ?? "", typeByKey.get(key) ?? "text");
    }
    // Unknown, non-preserved token → blank rather than literal braces.
    return "";
  });
}
