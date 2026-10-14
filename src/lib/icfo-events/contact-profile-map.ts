/**
 * Maps a Contact's profile (crm_contacts.profile) onto the "Register a guest" form.
 *
 * The Contacts vocabulary is not the form's: Contacts says "Angel Investor" where the
 * form says "Angel", and it stores ranges such as "$250k - $500k" where the form has its
 * own brackets. This file is the single place those two vocabularies meet. Every value it
 * returns is one of the form field's own options, so the form never holds a value its
 * dropdown can't show.
 *
 * Ranges (check size, round size) only fill when the Contact's whole range sits inside ONE
 * form option. Otherwise the field is left for the admin and given a hint with what the
 * profile says, because picking one of several overlapping options would be a guess.
 */

export type ContactProfileBits = {
  investorTypes: string[];
  fundingStages: string[];
  industries: string[];
  /** "Investor investment size?" */
  investmentSize: string[];
  /** "Entrepreneur funding stage?" */
  founderStage: string[];
  /** "Entrepreneur seeking amount of capital?" */
  seekAmount: string[];
  /** "Entrepreneur business summary" */
  businessSummary: string;
};

export type FieldLike = { key: string; kind: string; options?: string[] };

export type ProfileFill = {
  /** answer key to the value to write (a string, or a string[] for chip fields) */
  values: Record<string, string | string[]>;
  /** answer key to a short "where this came from" line */
  notes: Record<string, string>;
  /** answer key to what the profile says when it could not be mapped to one option */
  hints: Record<string, string>;
};

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const INVESTOR_TYPE: Record<string, string> = {
  angelinvestor: "Angel",
  venturecapital: "Venture Capital",
  privateequity: "Private Equity",
  familyoffice: "Family Office",
};

const STAGE: Record<string, string> = {
  preseed: "Pre-seed",
  seed: "Seed",
  seedround: "Seed",
  seriesa: "Series A",
  seriesb: "Series B+",
  seriesc: "Series B+",
};

function pickOption(options: string[] | undefined, label: string | undefined): string | null {
  if (!options || !label) return null;
  return options.find((o) => norm(o) === norm(label)) ?? null;
}

function unique<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

// ── ranges ───────────────────────────────────────────────────────────────────────────

const UNIT: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9 };

function parseAmount(s: string): number | null {
  const m = /\$?\s*(\d+(?:\.\d+)?)\s*([kmb])?/i.exec(s.replace(/,/g, ""));
  if (!m) return null;
  return Number(m[1]) * (m[2] ? UNIT[m[2].toLowerCase()] : 1);
}

/** "Less than $50k", "$50k - $100k", "Over $100m", "< $25k", "$2M+" to [low, high]; anything else (a stray "4") is null. */
export function bucketRange(label: string): [number, number] | null {
  const l = label.trim();
  if (/^(less than|under|<)/i.test(l)) {
    const n = parseAmount(l.replace(/^(less than|under|<)/i, ""));
    return n == null ? null : [0, n];
  }
  if (/^(over|more than|>)/i.test(l) || /\+$/.test(l)) {
    const n = parseAmount(l.replace(/^(over|more than|>)/i, ""));
    return n == null ? null : [n, Infinity];
  }
  const parts = l.split(/\s*(?:–|—|-)\s*|\s+to\s+/i);
  if (parts.length === 2) {
    const a = parseAmount(parts[0]);
    const b = parseAmount(parts[1]);
    if (a != null && b != null) return [a, b];
  }
  return null;
}

function fmt(n: number): string {
  if (n >= 1e6) return `$${n / 1e6}m`;
  if (n >= 1e3) return `$${n / 1e3}k`;
  return `$${n}`;
}

/** The overall span of a Contact's selected ranges, or null if none of them are real ranges. */
function span(labels: string[]): [number, number] | null {
  const rs = labels.map(bucketRange).filter((r): r is [number, number] => r !== null);
  if (rs.length === 0) return null;
  return [Math.min(...rs.map((r) => r[0])), Math.max(...rs.map((r) => r[1]))];
}

function spanText([lo, hi]: [number, number]): string {
  if (hi === Infinity) return `${fmt(lo)} or more`;
  if (lo === 0) return `less than ${fmt(hi)}`;
  return `${fmt(lo)} to ${fmt(hi)}`;
}

function oneLine(s: string): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= 300) return t;
  const cut = t.slice(0, 300);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  if (end > 120) return cut.slice(0, end + 1);
  return cut.slice(0, cut.lastIndexOf(" ")) + "…";
}

// ── the mapping ──────────────────────────────────────────────────────────────────────

export function mapProfileToFill(role: string, bits: ContactProfileBits | undefined, fields: FieldLike[]): ProfileFill {
  const out: ProfileFill = { values: {}, notes: {}, hints: {} };
  if (!bits) return out;
  const field = (key: string) => fields.find((f) => f.key === key);

  function fillRange(key: string, labels: string[]) {
    const f = field(key);
    if (!f?.options) return;
    const s = span(labels);
    if (!s) return;
    const hit = f.options.find((o) => {
      const r = bucketRange(o);
      return r !== null && r[0] <= s[0] && s[1] <= r[1];
    });
    if (hit) { out.values[key] = hit; out.notes[key] = "Mapped from the profile range"; }
    else out.hints[key] = `Profile says ${spanText(s)}`;
  }

  function fillStage(key: string, raw: string[], chips: boolean) {
    const f = field(key);
    if (!f?.options) return;
    const pairs = raw
      .map((r) => ({ r, o: pickOption(f.options, STAGE[norm(r)]) }))
      .filter((p): p is { r: string; o: string } => p.o !== null);
    if (pairs.length === 0) return;
    out.values[key] = chips ? unique(pairs.map((p) => p.o)) : pairs[0].o;
    out.notes[key] = chips
      ? `From the profile: ${unique(pairs.map((p) => p.r)).join(", ")}`
      : `Mapped from the profile value "${pairs[0].r}"`;
  }

  function fillSectors(key: string, chips: boolean) {
    const f = field(key);
    if (!f?.options) return;
    const matched = unique(bits!.industries.map((i) => pickOption(f.options, i)).filter((o): o is string => o !== null));
    if (matched.length === 0) return;
    out.values[key] = chips ? matched : matched[0];
    out.notes[key] = chips ? `From the profile: ${matched.join(", ")}` : "From the profile industries";
  }

  if (role === "investor") {
    const f = field("investorType");
    if (f?.options) {
      for (const t of bits.investorTypes) {
        const opt = pickOption(f.options, INVESTOR_TYPE[norm(t)]);
        if (opt) { out.values.investorType = opt; out.notes.investorType = `Mapped from the profile value "${t}"`; break; }
      }
    }
    fillRange("checkSize", bits.investmentSize);
    fillStage("stages", bits.fundingStages, true);
    fillSectors("sectors", true);
  } else if (role === "founder") {
    fillStage("stage", bits.founderStage, false);
    fillSectors("sector", false);
    fillRange("roundSize", bits.seekAmount);
    const pitch = bits.businessSummary ? oneLine(bits.businessSummary) : "";
    if (pitch && field("pitch")) { out.values.pitch = pitch; out.notes.pitch = "From the profile: Entrepreneur business summary"; }
  }
  return out;
}
