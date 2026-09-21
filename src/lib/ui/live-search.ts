// One search behaviour for every list on the platform.
//
// The bug this fixes is not "search doesn't filter" — most lists did filter.
// It is that nothing on screen confirmed it: the count above the table was the
// UNFILTERED total, nothing was highlighted, and an empty result looked like a
// broken page. Typing a common letter therefore looked like nothing happened.
//
// Pure functions only, so every list shares the same matching rules and they can
// be tested without rendering anything.

/** A searchable column: how to label it, and how to read it off a row. */
export type SearchField<T> = {
  /** Shown to the user: "company name", "founder", "stage". */
  label: string;
  get: (row: T) => string | number | null | undefined;
};

export type SearchResult<T> = {
  rows: T[];
  /** Rows before filtering — what the count line compares against. */
  total: number;
  /** Field labels that produced at least one hit, most hits first. */
  matchedFields: string[];
  /** True when a query is present. */
  active: boolean;
};

function norm(v: string | number | null | undefined): string {
  return v === null || v === undefined ? "" : String(v).toLowerCase();
}

/**
 * Filter rows against a free-text query.
 *
 * Every whitespace-separated term must match somewhere in the row (AND across
 * terms, OR across fields) so "imp deep" narrows rather than widens — the
 * behaviour people expect from a search box even though it is not what a naive
 * `includes` does.
 */
export function matchRows<T>(rows: T[], fields: SearchField<T>[], query: string): SearchResult<T> {
  const q = query.trim().toLowerCase();
  if (!q) return { rows, total: rows.length, matchedFields: [], active: false };

  const terms = q.split(/\s+/).filter(Boolean);
  const hits = new Map<string, number>();

  const out = rows.filter((row) => {
    const values = fields.map((f) => ({ label: f.label, text: norm(f.get(row)) }));
    const every = terms.every((t) => values.some((v) => v.text.includes(t)));
    if (!every) return false;
    for (const v of values) {
      if (terms.some((t) => v.text.includes(t))) hits.set(v.label, (hits.get(v.label) ?? 0) + 1);
    }
    return true;
  });

  const matchedFields = [...hits.entries()].sort((a, b) => b[1] - a[1]).map(([label]) => label);
  return { rows: out, total: rows.length, matchedFields, active: true };
}

/**
 * Split text into alternating plain / matched segments for highlighting.
 * Returns a single unmatched segment when there is nothing to mark, so callers
 * can render the result unconditionally.
 */
export function searchHit(text: string, query: string): Array<{ text: string; hit: boolean }> {
  const q = query.trim();
  if (!q || !text) return [{ text, hit: false }];

  const terms = [...new Set(q.toLowerCase().split(/\s+/).filter(Boolean))];
  const lower = text.toLowerCase();

  // Collect every match span, then merge overlaps so nested terms don't double-wrap.
  const spans: Array<[number, number]> = [];
  for (const t of terms) {
    let i = lower.indexOf(t);
    while (i !== -1) {
      spans.push([i, i + t.length]);
      i = lower.indexOf(t, i + t.length);
    }
  }
  if (!spans.length) return [{ text, hit: false }];

  spans.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [spans[0]];
  for (const [s, e] of spans.slice(1)) {
    const last = merged[merged.length - 1];
    if (s <= last[1]) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }

  const out: Array<{ text: string; hit: boolean }> = [];
  let cursor = 0;
  for (const [s, e] of merged) {
    if (s > cursor) out.push({ text: text.slice(cursor, s), hit: false });
    out.push({ text: text.slice(s, e), hit: true });
    cursor = e;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor), hit: false });
  return out;
}

/** "6 of 23 companies · matched on founder" — the line that was missing. */
export function searchSummary(result: { rows: unknown[]; total: number; matchedFields: string[]; active: boolean }, noun: string): string {
  if (!result.active) return `${result.total} ${noun}`;
  const head = `${result.rows.length} of ${result.total} ${noun}`;
  if (!result.rows.length || !result.matchedFields.length) return head;
  return `${head} · matched on ${result.matchedFields.slice(0, 2).join(" and ")}`;
}
