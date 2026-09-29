"use client";

import { searchHit, searchSummary } from "@/lib/ui/live-search";

/**
 * The feedback that was missing from every search box on the platform.
 *
 * Lists did filter, but the count above them read the UNFILTERED total and
 * nothing was highlighted — so typing a common letter looked like nothing had
 * happened. These three pieces make the filter visible.
 */

/** "6 of 23 companies · matched on founder". Plain total when no query. */
export function SearchCount({
  result,
  noun,
  className = "",
}: Readonly<{
  result: { rows: unknown[]; total: number; matchedFields: string[]; active: boolean };
  /** Plural noun for the rows: "companies", "investors", "tasks". */
  noun: string;
  className?: string;
}>) {
  const text = searchSummary(result, noun);
  return (
    <p className={`text-xs text-slate-500 ${className}`} aria-live="polite">
      {result.active ? (
        <>
          <span className="font-semibold tabular-nums text-slate-900">{result.rows.length}</span>
          {text.slice(String(result.rows.length).length)}
        </>
      ) : (
        text
      )}
    </p>
  );
}

/** Wraps the matched part of a value in a highlight. Safe with any text. */
export function Highlight({ text, query }: Readonly<{ text: string | null | undefined; query: string }>) {
  const value = text ?? "";
  const parts = searchHit(value, query);
  if (parts.length === 1 && !parts[0].hit) return <>{value}</>;
  return (
    <>
      {parts.map((p, i) =>
        p.hit ? (
          <mark key={`${i}-${p.text}`} className="rounded-[2px] bg-amber-200/70 px-0.5 text-inherit">
            {p.text}
          </mark>
        ) : (
          <span key={`${i}-${p.text}`}>{p.text}</span>
        ),
      )}
    </>
  );
}

/**
 * Empty state for a search that matched nothing. Names the fields that were
 * searched, so "no results" is a fact the user can act on rather than a dead end.
 */
export function NoSearchMatches({
  query,
  fields,
  onClear,
}: Readonly<{ query: string; fields: string[]; onClear?: () => void }>) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-7 text-center">
      <p className="text-sm font-semibold text-slate-900">Nothing matches &ldquo;{query}&rdquo;</p>
      <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
        Searched {fields.join(", ")}.
        {onClear ? (
          <>
            {" "}
            <button type="button" onClick={onClear} className="font-semibold text-indigo-600 hover:underline">
              Clear search
            </button>
          </>
        ) : null}
      </p>
    </div>
  );
}
