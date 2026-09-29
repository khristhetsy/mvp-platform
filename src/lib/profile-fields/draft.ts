/**
 * A field's options while being edited, and the rules for saving them.
 *
 * Pure: the page, the API and the tests share these, so the rules that could
 * lose a stored answer are checked in one place. Nothing is ever deleted: an
 * option can be renamed, reordered or retired, and every save and restore is
 * a new version.
 */

import type { VocabularyOption } from "@/lib/vocabulary/lists";
import { deriveSlug } from "@/lib/vocabulary/mutations";

export type DraftOption = {
  slug: string;
  label: string;
  archived: boolean;
  description?: string | null;
};

export type SaveRules = { addable: boolean; slugIsLabel: boolean; hasDescription?: boolean };

const norm = (o: DraftOption): DraftOption => ({
  slug: o.slug,
  label: o.label,
  archived: Boolean(o.archived),
  description: o.description ?? null,
});

/** Number of options that differ between two versions, including order. */
export function countChanges(saved: DraftOption[], draft: DraftOption[]): number {
  let n = 0;
  const bySlug = new Map(saved.map((o, i) => [o.slug, { o: norm(o), i }]));
  draft.forEach((d, i) => {
    const s = bySlug.get(d.slug);
    if (!s) { n += 1; return; }
    const a = s.o;
    const b = norm(d);
    if (a.label !== b.label || a.archived !== b.archived || (a.description ?? "") !== (b.description ?? "") || s.i !== i) n += 1;
  });
  return n;
}

/**
 * The built in list, applied over what exists. Options the default does not
 * know are kept and retired rather than dropped, because records may hold them.
 */
export function applyDefault(current: DraftOption[], fallback: VocabularyOption[]): DraftOption[] {
  const known = new Set(fallback.map((o) => o.slug));
  const base = fallback.map((o) => norm({ ...o, archived: false }));
  const extra = current.filter((o) => !known.has(o.slug)).map((o) => ({ ...norm(o), archived: true }));
  return [...base, ...extra];
}

/** One option back to its built in label and description. */
export function defaultOne(option: DraftOption, fallback: VocabularyOption[]): DraftOption {
  const f = fallback.find((o) => o.slug === option.slug);
  return f ? { ...option, label: f.label, description: f.description ?? null } : option;
}

/** The permanent key a newly added option gets. */
export function newSlug(label: string, rules: SaveRules): string {
  return rules.slugIsLabel ? label.trim() : deriveSlug(label);
}

export type SaveCheck = { ok: true } | { ok: false; reason: string };

/**
 * Whether a draft can be saved over the current options.
 *
 * Every existing key must still be present (nothing deletes), keys are unique,
 * labels are real and distinct, and new keys only appear where the list allows
 * additions.
 */
export function checkSave(existing: DraftOption[], next: DraftOption[], rules: SaveRules): SaveCheck {
  if (next.length === 0) return { ok: false, reason: "A list needs at least one option." };
  const nextSlugs = new Set<string>();
  const labels = new Set<string>();
  for (const o of next) {
    if (!o.slug.trim()) return { ok: false, reason: "An option is missing its key." };
    if (nextSlugs.has(o.slug)) return { ok: false, reason: `Two options share the key "${o.slug}".` };
    nextSlugs.add(o.slug);
    const label = o.label.trim();
    if (label.length < 2) return { ok: false, reason: "Every option needs a name of at least two characters." };
    if (label.length > 80) return { ok: false, reason: `"${label.slice(0, 30)}…" is too long.` };
    const key = label.toLowerCase();
    if (!o.archived && labels.has(key)) return { ok: false, reason: `Two options read "${label}".` };
    if (!o.archived) labels.add(key);
    if (!rules.hasDescription && o.description) return { ok: false, reason: "This list has no descriptions." };
  }
  for (const e of existing) {
    if (!nextSlugs.has(e.slug)) return { ok: false, reason: `"${e.label}" cannot be removed. Retire it instead.` };
  }
  const existingSlugs = new Set(existing.map((e) => e.slug));
  const added = next.filter((o) => !existingSlugs.has(o.slug));
  if (added.length && !rules.addable) return { ok: false, reason: "This list does not take new options." };
  if (next.every((o) => o.archived)) return { ok: false, reason: "At least one option must stay offered." };
  return { ok: true };
}

/* ── CSV export and import ─────────────────────────────────────────────── */

const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function toCsv(options: DraftOption[]): string {
  const rows = [["key", "label", "description", "retired"]];
  for (const o of options) rows.push([o.slug, o.label, o.description ?? "", o.archived ? "yes" : "no"]);
  return rows.map((r) => r.map(cell).join(",")).join("\n") + "\n";
}

function parseLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i += 1; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

/**
 * Read a CSV exported from this page. Rows are matched by key; unknown keys are
 * new options. Existing options missing from the file are kept as they are, so
 * an import can never drop an answer's option.
 */
export function fromCsv(text: string, current: DraftOption[]): { ok: true; options: DraftOption[] } | { ok: false; reason: string } {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  if (lines.length < 2) return { ok: false, reason: "The file has no rows." };
  const head = parseLine(lines[0]).map((h) => h.trim().toLowerCase());
  const ki = head.indexOf("key");
  const li = head.indexOf("label");
  if (ki < 0 || li < 0) return { ok: false, reason: 'The file needs "key" and "label" columns.' };
  const di = head.indexOf("description");
  const ri = head.indexOf("retired");
  const imported: DraftOption[] = lines.slice(1).map((l) => {
    const c = parseLine(l);
    return {
      slug: (c[ki] ?? "").trim(),
      label: (c[li] ?? "").trim(),
      description: di >= 0 ? (c[di] ?? "").trim() || null : null,
      archived: ri >= 0 ? /^(yes|true|1)$/i.test((c[ri] ?? "").trim()) : false,
    };
  });
  const seen = new Set(imported.map((o) => o.slug));
  const kept = current.filter((o) => !seen.has(o.slug));
  return { ok: true, options: [...imported, ...kept] };
}
