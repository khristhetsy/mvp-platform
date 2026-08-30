// Form D Desk — Investor Mode · §5 Firm normalization.
// Reduces a filing entity_name to a stable `firm_stem` so a firm's many Reg D
// vehicles roll up to one firm. Pure function, no network, no DB. Applied in the
// order the spec fixes; each rule strips TRAILING tokens only (except years).
//
// Grouping key is firm_stem + state_or_country — geography is required, handled by
// the caller. Accepted failure modes (v0.2): target-named SPVs keep a distinct
// stem (they're deal vehicles, shouldn't roll up); stems < 3 chars fall back to
// the cleaned raw name and set needsReview; rebrands split (manual merge only).

const ENTITY_SUFFIX = new Set(["lp", "llc", "ltd", "inc", "corp", "company", "co"]);
const FUND_ROLE = new Set(["fund", "partners", "management", "advisors", "holdings", "ventures"]);
// Two-word trailing phrases stripped as a unit (checked before single words).
const FUND_ROLE_PHRASES = ["capital partners"];
const VEHICLE_WORDS = new Set([
  "annex", "overage", "parallel", "feeder", "master", "offshore", "onshore", "qp", "ai", "co-invest", "spv",
  "international", "domestic", "intermediate", "aggregator", "blocker", "trust",
]);
const ROMAN = new Set([
  "i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x",
  "xi", "xii", "xiii", "xiv", "xv", "xvi", "xvii", "xviii", "xix", "xx",
]);
const ORDINALS = new Set([
  "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th",
  "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth",
]);

/** Normalize dotted abbreviations (L.P. -> LP, L.L.C. -> LLC) before tokenizing. */
function dedot(name: string): string {
  return name.replace(/\b([A-Za-z])\.(?=[A-Za-z]\.)/g, "$1").replace(/\b([A-Za-z])\.(?=\s|$)/g, "$1");
}

function cleanStem(s: string): string {
  return s
    .replace(/\b\d{4}\b/g, " ") // four-digit years, anywhere
    .replace(/[^\p{L}\p{N}\s-]/gu, " ") // strip punctuation (keep hyphen for co-invest)
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export type NormalizedFirm = { firmStem: string; needsReview: boolean };

export function normalizeFirm(entityName: string): NormalizedFirm {
  const raw = (entityName ?? "").trim();
  if (!raw) return { firmStem: "", needsReview: true };

  // "X, a Series of Y" / "X, a series of Y" — the firm is the master (Y), so all
  // series of one fund family roll up together. Take the text after "series of".
  const series = raw.match(/\ba series of\s+(.+)$/i);
  const source = series ? series[1] : raw;

  let work = dedot(source).toLowerCase().replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();

  // Iteratively strip trailing tokens/phrases until nothing more matches.
  let changed = true;
  while (changed) {
    changed = false;

    for (const phrase of FUND_ROLE_PHRASES) {
      if (work.endsWith(" " + phrase) || work === phrase) {
        work = work.slice(0, work.length - phrase.length).trim();
        changed = true;
      }
    }

    const tokens = work.split(" ");
    const last = tokens[tokens.length - 1];
    // Trailing code/number fragments: years, and alphanumeric codes like
    // "22-41600" or "ar-0708" (≤3 leading letters, then digits/hyphens).
    const isCode = /^\d{4}$/.test(last ?? "") || /^[a-z]{0,3}-?\d[\d-]*$/.test(last ?? "");
    if (
      last &&
      (ENTITY_SUFFIX.has(last) || FUND_ROLE.has(last) || VEHICLE_WORDS.has(last) || ROMAN.has(last) || ORDINALS.has(last) || isCode)
    ) {
      tokens.pop();
      work = tokens.join(" ").trim();
      changed = true;
    }
  }

  const stem = cleanStem(work);

  // Stems under 3 chars are too weak to group on — fall back to the cleaned raw
  // name and flag for a human (§5).
  if (stem.replace(/[\s-]/g, "").length < 3) {
    return { firmStem: cleanStem(raw), needsReview: true };
  }
  return { firmStem: stem, needsReview: false };
}
