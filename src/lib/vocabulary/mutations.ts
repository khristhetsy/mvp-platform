/**
 * Adding, renaming and retiring an option.
 *
 * Pure rules first, so the important ones are testable without a database: a
 * slug is derived once and never changes, nothing is ever deleted, and no
 * value is merged into another on anyone's behalf.
 */

import type { VocabularyOption } from "@/lib/vocabulary/lists";

/**
 * The permanent key for a new option.
 *
 * Derived from the label the first time and then frozen — stored answers point
 * at it, so a later rewording changes what people read and nothing else.
 */
export function deriveSlug(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export type AddCheck =
  | { ok: true; slug: string }
  | { ok: false; reason: string };

/**
 * Whether a new value can be added.
 *
 * A slug that already exists is refused rather than quietly reused — including
 * when the existing row is archived, because reviving it and creating a new
 * one are different intentions and the caller has to say which.
 */
export function checkAdd(existing: VocabularyOption[], label: string): AddCheck {
  const trimmed = label.trim();
  if (trimmed.length < 2) return { ok: false, reason: "Give it a name of at least two characters." };
  if (trimmed.length > 80) return { ok: false, reason: "That name is too long." };

  const slug = deriveSlug(trimmed);
  if (!slug) return { ok: false, reason: "That name has no letters or numbers in it." };

  const clash = existing.find((o) => o.slug === slug);
  if (clash) {
    return {
      ok: false,
      reason: clash.archived
        ? `“${clash.label}” already exists but is archived. Restore it instead of adding a duplicate.`
        : `“${clash.label}” already uses that key.`,
    };
  }
  return { ok: true, slug };
}

export type RenameCheck = { ok: true } | { ok: false; reason: string };

/** Renaming changes the label only. A request that tries to move the key is refused. */
export function checkRename(
  existing: VocabularyOption[],
  slug: string,
  label: string,
): RenameCheck {
  const trimmed = label.trim();
  if (trimmed.length < 2) return { ok: false, reason: "Give it a name of at least two characters." };
  if (!existing.some((o) => o.slug === slug)) return { ok: false, reason: "That option no longer exists." };

  // Two options reading identically is a trap for whoever picks from the list.
  const twin = existing.find(
    (o) => o.slug !== slug && o.label.trim().toLowerCase() === trimmed.toLowerCase(),
  );
  if (twin) return { ok: false, reason: `“${twin.label}” already reads that way.` };

  return { ok: true };
}
