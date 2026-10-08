/**
 * Reading a use-of-funds paragraph as an allocation.
 *
 * Founders write this as prose — "1. Sales & marketing (~45%) — hire a growth
 * lead…" — and the one-pager printed the paragraph. An investor scanning for
 * where the money goes should not have to parse three numbered sentences.
 *
 * Pure, and deliberately unwilling to guess: if the text does not carry clear
 * percentages, nothing is drawn and the prose is shown as written. A bar built
 * from a misread number is worse than no bar.
 */

export type FundsSlice = {
  label: string;
  /** Whole percent. */
  percent: number;
};

/** Longest a slice label may be before it stops being a label. */
const MAX_LABEL = 40;

const CLEAN = /^[\s\-–—•*\d.()]+/;

function tidy(raw: string): string {
  return raw
    .replace(CLEAN, "")
    .replace(/\*\*/g, "")
    .replace(/[—–-]\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The slices, or null when the text does not clearly describe any.
 *
 * Requires at least two, each with a percentage, and a total that is plausible
 * (85–115%) — a paragraph mentioning "12%" in passing should not become a
 * chart.
 */
export function parseUseOfFunds(text: string | null | undefined): FundsSlice[] | null {
  if (!text?.trim()) return null;

  const slices: FundsSlice[] = [];
  // Each line or sentence that carries a percentage: label first, percent in
  // brackets or after a dash.
  for (const line of text.split(/\n|(?<=\.)\s+(?=\d+\.)/)) {
    const m = /(\d{1,3})\s*%/.exec(line);
    if (!m) continue;
    const percent = Number(m[1]);
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) continue;

    // The label is what comes before the percentage, minus numbering and
    // bracket noise.
    const before = line.slice(0, m.index).replace(/\(~?$/, "").trim();
    const label = tidy(before);
    if (!label || label.length > MAX_LABEL) continue;
    slices.push({ label, percent });
  }

  if (slices.length < 2) return null;
  const total = slices.reduce((s, x) => s + x.percent, 0);
  if (total < 85 || total > 115) return null;
  return slices;
}

/** The remainder, when the slices do not quite reach 100. */
export function unallocated(slices: FundsSlice[]): number {
  const total = slices.reduce((s, x) => s + x.percent, 0);
  return Math.max(0, Math.round(100 - total));
}

/** One run of text in a use-of-funds line; `bold` for words the founder wrapped in **. */
export type FundsTextPart = { text: string; bold: boolean };

/** One line of the founder's own text, as the one-pager shows it under the bar. */
export type FundsTextLine = {
  kind: "item" | "bullet" | "para";
  /** "1." for a numbered item, null otherwise. */
  marker: string | null;
  parts: FundsTextPart[];
};

function boldParts(line: string): FundsTextPart[] {
  const parts: FundsTextPart[] = [];
  let last = 0;
  for (const m of line.matchAll(/\*\*(.+?)\*\*/g)) {
    if (m.index > last) parts.push({ text: line.slice(last, m.index), bold: false });
    parts.push({ text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < line.length) parts.push({ text: line.slice(last), bold: false });
  // A lone ** with no partner is markdown noise, never shown as asterisks.
  return parts
    .map((p) => ({ ...p, text: p.text.replace(/\*\*/g, "") }))
    .filter((p) => p.text.length > 0);
}

/**
 * The founder's use-of-funds text, line by line, for display under the bar:
 * every word they wrote is kept; only markdown marks become formatting
 * (**bold**, "1." numbered items, "-" bullets) and blank lines are dropped.
 */
export function fundsTextLines(text: string | null | undefined): FundsTextLine[] {
  if (!text?.trim()) return [];
  const out: FundsTextLine[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const numbered = /^(\d{1,2})[.)]\s+(.*)$/.exec(line);
    if (numbered) {
      out.push({ kind: "item", marker: `${numbered[1]}.`, parts: boldParts(numbered[2]) });
      continue;
    }
    const bullet = /^[-•]\s+(.*)$/.exec(line) ?? /^\*\s+(.*)$/.exec(line);
    if (bullet) {
      out.push({ kind: "bullet", marker: null, parts: boldParts(bullet[1]) });
      continue;
    }
    out.push({ kind: "para", marker: null, parts: boldParts(line) });
  }
  return out;
}
