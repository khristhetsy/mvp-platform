/**
 * What changed, in a form safe to store.
 *
 * The open question from the design was whether an event records the old value
 * ("$750,000 → $400,000") or only the field name ("changed the capital ask").
 * The answer here is: the old value, but only for an explicit allow-list.
 *
 * A bare "profile updated" is not worth a notification — you would have to open
 * the company to learn anything, which defeats the point. But founder business
 * data sitting in a second table with its own retention is a real cost, so the
 * allow-list is the contract: a field that is not on it contributes its NAME to
 * the diff and never its value. Adding a field to the list is a deliberate act.
 *
 * Pure — no Supabase, no fetch.
 */

/** Fields whose before/after values may be stored. Everything else is name-only. */
export const DIFF_VALUE_ALLOWLIST = new Set<string>([
  // Money and terms — the whole reason a diff is worth having
  "funding_amount",
  "valuation",
  "pre_money_valuation",
  "offering_type",
  "annual_revenue_size",
  "arr",
  "mrr",
  // Stage and status — short, enumerated, and meaningless without the values
  "funding_stage",
  "revenue_stage",
  "stage",
  "status",
  "interest_stage",
  "visibility",
  "is_published",
  // Counts and scores
  "crr_score",
  "shareholder_count",
  "recipient_count",
  "file_count",
  // Document identity (the label, never the path or URL — sanitize drops those)
  "document_type",
  "document_label",
  "version",
]);

export type FieldChange = {
  field: string;
  /** Present only for allow-listed fields. */
  from?: unknown;
  to?: unknown;
};

export type ActivityDiff = {
  /** Field names that changed, always populated. */
  fields: string[];
  /** Before/after for the allow-listed subset. */
  changes: FieldChange[];
  /** True when at least one field changed. */
  changed: boolean;
};

const EMPTY: ActivityDiff = { fields: [], changes: [], changed: false };

function normalize(value: unknown): unknown {
  if (value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  return value;
}

function sameValue(a: unknown, b: unknown): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return true;
  // Arrays and objects: compare shallowly by JSON. Deep-equality is not worth
  // the cost here — a false "changed" is a noisy notification, not a bug.
  if (na !== null && nb !== null && typeof na === "object" && typeof nb === "object") {
    try {
      return JSON.stringify(na) === JSON.stringify(nb);
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Diff two snapshots.
 *
 * `fields` limits which keys are considered at all — pass the ones the route
 * actually writes, so an unrelated column touched by a trigger does not read as
 * a founder edit.
 */
export function diffSnapshots(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
  fields?: readonly string[],
): ActivityDiff {
  if (!before || !after) return EMPTY;

  const keys = fields?.length
    ? [...fields]
    : [...new Set([...Object.keys(before), ...Object.keys(after)])];

  const changed: FieldChange[] = [];
  for (const key of keys) {
    if (sameValue(before[key], after[key])) continue;
    changed.push(
      DIFF_VALUE_ALLOWLIST.has(key)
        ? { field: key, from: normalize(before[key]), to: normalize(after[key]) }
        : { field: key },
    );
  }

  return {
    fields: changed.map((c) => c.field),
    changes: changed,
    changed: changed.length > 0,
  };
}

/** "$750,000 → $400,000", or "capital ask" when the value is not allow-listed. */
export function describeChange(change: FieldChange, label?: string): string {
  const name = label ?? change.field.replace(/_/g, " ");
  if (!("from" in change)) return name;
  const from = formatDiffValue(change.from);
  const to = formatDiffValue(change.to);
  return `${name} ${from} → ${to}`;
}

export function formatDiffValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "number") {
    // Money-sized numbers read better grouped; small ones are counts.
    return value >= 1000 ? value.toLocaleString("en-US") : String(value);
  }
  return String(value);
}

/** One line summarising the whole diff, for the event title. */
export function summarizeDiff(diff: ActivityDiff, max = 2): string {
  if (!diff.changed) return "no change";
  const shown = diff.changes.slice(0, max).map((c) => describeChange(c));
  const rest = diff.changes.length - shown.length;
  return rest > 0 ? `${shown.join(", ")} and ${rest} more` : shown.join(", ");
}
