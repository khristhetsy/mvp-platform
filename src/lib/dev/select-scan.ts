/**
 * Finding every column the code asks Postgres for.
 *
 * Supabase calls in this codebase go through `any` casts, so `tsc` cannot see
 * a column name at all: `.select("readiness_score")` on a table that has never
 * had that column type-checks perfectly, passes lint, passes every test, and
 * fails only at runtime — where the error is usually discarded. That one
 * survived months and silently blanked a whole panel.
 *
 * This extracts the table/column pairs from source text so a test can check
 * them against the real schema. Pure: string in, findings out.
 */

export type SelectUse = {
  table: string;
  column: string;
  /** 1-based line of the `.from(...)` call, for a useful failure message. */
  line: number;
};

/**
 * A `.select()` argument, when it is a plain string or a concatenation of
 * them. Template literals and variables are skipped — their value isn't
 * knowable here, and guessing would produce false failures.
 */
function literalArg(source: string, openParen: number): string | null {
  let i = openParen + 1;
  let out = "";
  let sawString = false;

  while (i < source.length) {
    const ch = source[i];
    if (ch === " " || ch === "\n" || ch === "\r" || ch === "\t") { i += 1; continue; }
    if (ch === "+") { i += 1; continue; }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      let str = "";
      while (j < source.length && source[j] !== quote) {
        if (source[j] === "\\") { str += source[j + 1] ?? ""; j += 2; continue; }
        str += source[j];
        j += 1;
      }
      out += str;
      sawString = true;
      i = j + 1;
      continue;
    }
    // Anything else — a template literal, a variable, a second argument.
    break;
  }
  return sawString ? out : null;
}

/**
 * Strip PostgREST's embedded-resource groups.
 *
 * `events:event_id(title, slug)` and `companies!inner(id)` select from another
 * table, so neither the resource name nor its columns belong to this table.
 * The name in front of the bracket has to go too — leaving it behind is what
 * makes a join look like a missing column.
 */
export function stripEmbeds(sel: string): string {
  let out = "";
  let depth = 0;
  for (const ch of sel) {
    if (ch === "(") {
      depth += 1;
      if (depth === 1) {
        // Drop the resource name this bracket belongs to, back to the
        // separator before it.
        const cut = Math.max(out.lastIndexOf(","), out.lastIndexOf(" "));
        out = out.slice(0, cut + 1);
      }
      continue;
    }
    if (ch === ")") { depth = Math.max(0, depth - 1); continue; }
    if (depth === 0) out += ch;
  }
  return out;
}

/** One column reference reduced to the column name, or null if unusable. */
export function columnOf(part: string): string | null {
  let p = part.trim();
  if (!p || p === "*") return null;
  // `alias:column` — the real column is on the right.
  if (p.includes(":")) p = p.slice(p.lastIndexOf(":") + 1).trim();
  // Embedded-resource leftovers, hints and modifiers.
  p = p.replace(/!.*$/, "").replace(/::.*$/, "").trim();
  if (!p || p === "*") return null;
  // Aggregates and anything that isn't a bare identifier.
  if (!/^[a-z_][a-z0-9_]*$/i.test(p)) return null;
  return p;
}

const FROM_RE = /\.from\(\s*["']([a-z_][a-z0-9_]*)["']\s*\)/gi;

/**
 * Every column this source asks for, by table.
 *
 * A `.select()` is attributed to the nearest preceding `.from("table")` — the
 * shape every call in this codebase uses. Chains that build the table name
 * dynamically are skipped rather than guessed at.
 */
export function scanSelects(source: string): SelectUse[] {
  const out: SelectUse[] = [];
  const lineOf = (index: number) => source.slice(0, index).split("\n").length;

  for (const m of source.matchAll(FROM_RE)) {
    const table = m[1];
    const after = m.index + m[0].length;

    // The select belonging to this from(): the first `.select(` before the
    // next `.from(` starts a different chain.
    const nextFrom = source.indexOf(".from(", after);
    const limit = nextFrom === -1 ? source.length : nextFrom;
    const selAt = source.indexOf(".select(", after);
    if (selAt === -1 || selAt >= limit) continue;

    const arg = literalArg(source, selAt + ".select(".length - 1);
    if (arg === null) continue;

    for (const part of stripEmbeds(arg).split(",")) {
      const col = columnOf(part);
      if (col) out.push({ table, column: col, line: lineOf(m.index) });
    }
  }
  return out;
}
