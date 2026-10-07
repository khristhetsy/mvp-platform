// Condensed email (Deal introduction and any master whose slots declare
// `condense`). The email carries a short form of the long slots; the whole
// text lives on the full overview page (/e/overview/[copyId]). Each copy
// stores its choice per slot in slot_values under `view_<key>` ("short" or
// "full"), so switching back to Full never loses text.

import type { PlaceholderSchema, TemplateSlot } from "./template-schema";

export const viewKey = (slotKey: string) => `view_${slotKey}`;

/** Paragraphs as the richtext renderer splits them (blank line between). */
export function splitParagraphs(value: string): string[] {
  return (value ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Non-empty lines, as the list renderer reads them. */
export function splitLines(value: string): string[] {
  return (value ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Slots that get their own "What shows in the email" control. */
export function condenseControls(schema: PlaceholderSchema): TemplateSlot[] {
  return schema.slots.filter((s) => s.condense && !s.condense_with);
}

/** True when this slot is in its short form for the copy. */
export function isShort(schema: PlaceholderSchema, values: Record<string, string>, slot: TemplateSlot): boolean {
  const owner = slot.condense_with ? schema.slots.find((s) => s.key === slot.condense_with) ?? slot : slot;
  const chosen = values[viewKey(owner.key)];
  if (chosen === "full" || chosen === "short") return chosen === "short";
  return (owner.condense_default ?? "short") === "short";
}

export type CondenseResult = {
  values: Record<string, string>;
  /** Some text was left out of the email, so it needs the overview link. */
  condensed: boolean;
};

export function condenseSlots(schema: PlaceholderSchema, values: Record<string, string>): CondenseResult {
  const out = { ...values };
  let condensed = false;
  for (const slot of schema.slots) {
    if (!slot.condense || !isShort(schema, values, slot)) continue;
    const raw = (values[slot.key] ?? "").trim();
    if (!raw) continue;
    if (slot.condense === "first_paragraph") {
      const paras = splitParagraphs(raw);
      if (paras.length > 1) {
        out[slot.key] = paras[0];
        condensed = true;
      }
    } else if (slot.condense === "first_3") {
      const lines = splitLines(raw);
      if (lines.length > 3) {
        out[slot.key] = lines.slice(0, 3).join("\n");
        condensed = true;
      }
    } else {
      out[slot.key] = "";
      condensed = true;
    }
  }
  return { values: out, condensed };
}

/** Public overview page for a copy. */
export function overviewUrl(copyId: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com").replace(/\/+$/, "");
  return `${base}/e/overview/${copyId}`;
}
