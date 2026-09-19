"use client";

/**
 * The toolbar every founder list wears: primary action · gear · search · Columns · View.
 *
 * Same left-to-right order as the admin lists, and the same OdooSearchBar
 * underneath — pointed at the founder-scoped saved-views endpoint, with sharing
 * off. Founders are alone on their own data, so there is no Me/Team/Someone-else
 * switcher and no shared favorites.
 *
 * The page owns its rows and its SearchState; this only renders the chrome.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  OdooSearchBar, type FieldFilter, type GroupOption, type QuickFilter, type SearchState,
} from "@/components/admin/OdooSearchBar";

export type ColumnToggle = { key: string; label: string; hidden?: boolean };
export type Density = "comfortable" | "compact";

const btn: React.CSSProperties = {
  border: "1px solid var(--border, #D6DDE8)", borderRadius: 8, padding: "5px 11px", fontSize: 12,
  background: "var(--background, #fff)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
};
const menu: React.CSSProperties = {
  position: "absolute", top: "calc(100% + 5px)", right: 0, zIndex: 40, minWidth: 210,
  border: "1px solid var(--border, #D6DDE8)", borderRadius: 10, background: "var(--background, #fff)",
  boxShadow: "0 14px 34px rgba(15,23,42,.14)", padding: "6px 0",
};
const row: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", fontSize: 12.5, cursor: "pointer", width: "100%", background: "none", border: "none", textAlign: "left" };
const head: React.CSSProperties = { fontSize: 10, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted-foreground, #94A3B8)", fontWeight: 600, padding: "5px 12px" };

/** Close on outside click / Escape — the behaviour every one of these menus needs. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open, close]);
  return ref;
}

export function FounderToolbar({
  scope, state, onChange, quick, fields, groups,
  placeholder, noGroupId = "none", primary, columns, onToggleColumn,
  density = "comfortable", onDensity, count, countLabel = "records", right,
}: {
  /** Page key — namespaced to `founder:<scope>` by the API. */
  scope: string;
  state: SearchState;
  onChange: (next: SearchState) => void;
  quick: QuickFilter[];
  fields: FieldFilter[];
  groups: GroupOption[];
  placeholder?: string;
  noGroupId?: string;
  /** The page's own New / primary button, rendered leftmost. */
  primary?: ReactNode;
  columns?: ColumnToggle[];
  onToggleColumn?: (key: string) => void;
  density?: Density;
  onDensity?: (d: Density) => void;
  /** Row count shown next to the primary action, like the admin lists. */
  count?: number;
  countLabel?: string;
  /** Anything extra on the far right (a view switcher the page owns, say). */
  right?: ReactNode;
}) {
  const [gearOpen, setGearOpen] = useState(false);
  const [colsOpen, setColsOpen] = useState(false);
  const gearRef = useDismiss(gearOpen, () => setGearOpen(false));
  const colsRef = useDismiss(colsOpen, () => setColsOpen(false));

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid var(--border, #EEF1F6)", flexWrap: "wrap" }}>
      {primary}

      {(onDensity || columns) && (
        <div ref={gearRef} style={{ position: "relative" }}>
          <button type="button" style={{ ...btn, padding: "5px 8px" }} aria-label="View settings" aria-expanded={gearOpen} onClick={() => setGearOpen((v) => !v)}>
            <i className="ti ti-settings" aria-hidden="true" />
          </button>
          {gearOpen && (
            <div style={menu}>
              <p style={head}>View settings</p>
              {onDensity && (["comfortable", "compact"] as const).map((d) => (
                <button key={d} type="button" style={row} onClick={() => { onDensity(d); setGearOpen(false); }}>
                  <span style={{ width: 14, color: "#4F46E5" }}>{density === d ? "✓" : ""}</span>
                  <span style={{ textTransform: "capitalize" }}>{d}</span>
                </button>
              ))}
              {columns?.length ? (
                <>
                  <div style={{ borderTop: "0.5px solid var(--border, #eef1f5)", margin: "5px 0" }} />
                  <button type="button" style={row} onClick={() => { setGearOpen(false); setColsOpen(true); }}>
                    <span style={{ width: 14 }} /><span>Columns…</span>
                  </button>
                </>
              ) : null}
            </div>
          )}
        </div>
      )}

      {typeof count === "number" && (
        <span style={{ fontSize: 12, color: "var(--muted-foreground, #64748B)", fontVariantNumeric: "tabular-nums" }}>
          {count.toLocaleString()} {countLabel}
        </span>
      )}

      <OdooSearchBar
        scope={scope}
        state={state}
        onChange={onChange}
        quick={quick}
        fields={fields}
        groups={groups}
        noGroupId={noGroupId}
        placeholder={placeholder}
        api="/api/founder/saved-views"
        personalOnly
        width={520}
      />

      <span style={{ flex: 1 }} />

      {columns?.length ? (
        <div ref={colsRef} style={{ position: "relative" }}>
          <button type="button" style={btn} aria-expanded={colsOpen} onClick={() => setColsOpen((v) => !v)}>Columns</button>
          {colsOpen && (
            <div style={menu}>
              <p style={head}>Show columns</p>
              {columns.map((c) => (
                <button key={c.key} type="button" style={row} onClick={() => onToggleColumn?.(c.key)}>
                  <span style={{ width: 14, color: "#4F46E5" }}>{c.hidden ? "" : "✓"}</span>
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {right}
    </div>
  );
}

/**
 * Apply a SearchState to a page's rows.
 *
 * Every founder list filters client-side over a list it already has, so one
 * shared matcher keeps the eight pages behaving identically: free text across the
 * fields the page nominates, quick filters as predicates, field filters as
 * value-in-set.
 */
export function applySearch<T>(
  rows: T[],
  state: SearchState,
  cfg: {
    /** Free-text haystack for one row. */
    text: (row: T) => string;
    /** Quick-filter key → predicate. Unknown keys are ignored. */
    quick?: Record<string, (row: T) => boolean>;
    /** Field key → the row's value(s) for that field. */
    field?: Record<string, (row: T) => string | string[] | null | undefined>;
  },
): T[] {
  const q = state.q.trim().toLowerCase();
  return rows.filter((r) => {
    if (q && !cfg.text(r).toLowerCase().includes(q)) return false;
    for (const k of state.quick) {
      const pred = cfg.quick?.[k];
      if (pred && !pred(r)) return false;
    }
    for (const [key, wanted] of Object.entries(state.fields)) {
      if (!wanted.length) continue;
      const get = cfg.field?.[key];
      if (!get) continue;
      const v = get(r);
      const have = Array.isArray(v) ? v : v ? [v] : [];
      if (!have.some((x) => wanted.includes(x))) return false;
    }
    return true;
  });
}

/** Group rows for the Group by option. Returns one bucket when not grouped. */
export function groupRows<T>(
  rows: T[],
  groupBy: string,
  noGroupId: string,
  key: Record<string, (row: T) => string>,
): Array<{ label: string; rows: T[] }> {
  const get = groupBy && groupBy !== noGroupId ? key[groupBy] : undefined;
  if (!get) return [{ label: "", rows }];
  const buckets = new Map<string, T[]>();
  for (const r of rows) {
    const k = get(r) || "—";
    buckets.set(k, [...(buckets.get(k) ?? []), r]);
  }
  return [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([label, rs]) => ({ label, rows: rs }));
}
