/**
 * Booklet names.
 *
 * A booklet used to be created the moment an event was picked, with a title
 * generated from the event and never checked — so two runs produced two rows
 * that were identical in every visible way. Naming is now a decision the admin
 * makes before anything is written, which means the rules for what counts as
 * "the same name" have to live somewhere testable.
 *
 * Pure: no database, no network.
 */

/** Trim and collapse runs of whitespace — what gets stored. */
export function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ");
}

/**
 * What makes two names the same.
 *
 * Case-insensitive, whitespace-insensitive: "Issue 2026" and "issue  2026"
 * are one name to a person reading the library, so they are one name here.
 */
export function titleKey(title: string): string {
  return normalizeTitle(title).toLowerCase();
}

export const MAX_TITLE_LENGTH = 160;

/** Why a name can't be used, or null when it's fine. */
export function validateTitle(title: string): string | null {
  const t = normalizeTitle(title);
  if (!t) return "Give the booklet a name.";
  if (t.length > MAX_TITLE_LENGTH) return `Keep the name under ${MAX_TITLE_LENGTH} characters.`;
  return null;
}

/** The name offered when you open the dialog. */
export function suggestTitle(eventTitle: string, year: number = new Date().getFullYear()): string {
  return normalizeTitle(`${eventTitle} — Issue ${year}`);
}

/**
 * Is this name already used among `existing`?
 *
 * `exceptId` lets a rename ignore the booklet being renamed — otherwise saving
 * a title unchanged would collide with itself.
 */
export function isTitleTaken(
  title: string,
  existing: { id: string; title: string }[],
  exceptId?: string,
): boolean {
  const key = titleKey(title);
  return existing.some((e) => e.id !== exceptId && titleKey(e.title) === key);
}

/**
 * `base`, or the first free "base (2)", "base (3)"… .
 *
 * An already-numbered name is stripped back to its stem first, so cloning
 * "Issue 2026 (2)" offers "(3)" rather than "(2) (2)".
 */
export function nextAvailableTitle(
  base: string,
  existing: { id: string; title: string }[],
  exceptId?: string,
): string {
  const stem = normalizeTitle(base).replace(/\s*\(\d+\)$/, "");
  if (!isTitleTaken(stem, existing, exceptId)) return stem;
  for (let n = 2; n < 500; n += 1) {
    const candidate = `${stem} (${n})`;
    if (!isTitleTaken(candidate, existing, exceptId)) return candidate;
  }
  // 500 booklets deep for one event is not a real case; fall back to something
  // unique rather than looping forever or returning a name that collides.
  return `${stem} (${Date.now()})`;
}
