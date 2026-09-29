"use client";

/**
 * Table pieces shared by the matching queue's two tabs (Proposed matches and Search all
 * investors): the row shape, the optional columns, how a cell renders, and header sorting.
 */
import Link from "next/link";
import { IR_STAGES, IR_STAGE_LABEL, type IrStage } from "@/lib/ir/types";

export type Outreach = { matchId: string; stage: IrStage; stageChangedAt: string; projectTitle: string };
/** fit < 0 marks a row found by "Search all investors" rather than scored by the engine. */
export type Row = {
  contactId: string; name: string | null; firm: string; fit: number; tier: "high" | "medium" | "low"; summary: string;
  sectors: string[]; types: string[]; dataSource: string | null; verifiedAt?: string | null; alsoOn: string[];
  founderOutreach: Outreach | null; onProject?: boolean; email?: string; phone?: string;
};

export const TIER_CLS = { high: "bg-emerald-50 text-emerald-700", medium: "bg-amber-50 text-amber-700", low: "bg-slate-100 text-slate-600" };
export const STAGE_CLS: Partial<Record<IrStage, string>> = { passed: "bg-rose-50 text-rose-700", committed: "bg-emerald-50 text-emerald-700", meeting_scheduled: "bg-indigo-50 text-indigo-700", meeting_held: "bg-indigo-50 text-indigo-700" };
export const srcLabel = (s: string | null) => (s === "verified" ? "Verified" : s === "self_reported" ? "Self-reported" : "Unverified");
export const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** Optional columns. Investor and the checkbox are always shown. */
export type ColKey = "outreach" | "firm" | "phone" | "email" | "fit" | "why" | "sectors" | "types" | "source" | "also";
export const COLS: Array<{ key: ColKey; label: string; on: boolean }> = [
  { key: "outreach", label: "Outreach", on: true }, { key: "firm", label: "Firm", on: true },
  { key: "phone", label: "Phone", on: true }, { key: "email", label: "Email", on: true },
  { key: "fit", label: "Fit", on: true }, { key: "why", label: "Why", on: true },
  { key: "sectors", label: "Sectors", on: false }, { key: "types", label: "Investor type", on: false },
  { key: "source", label: "Data source", on: true }, { key: "also", label: "Also matched", on: true },
];
export const DEFAULT_COLS = COLS.filter((c) => c.on).map((c) => c.key);

export function OutreachPill({ o }: { o: Outreach | null }) {
  if (!o) return <span className="text-slate-400">Not contacted</span>;
  return (
    <Link href={`/admin/ir/matches/${o.matchId}`} title={`Open the match on ${o.projectTitle}`} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium hover:ring-1 hover:ring-current ${STAGE_CLS[o.stage] ?? "bg-sky-50 text-sky-700"}`}>
      {IR_STAGE_LABEL[o.stage]} <span className="font-normal opacity-75">{fmtDay(o.stageChangedAt)}</span> <i className="ti ti-arrow-right" aria-hidden="true" />
    </Link>
  );
}

export function cell(k: ColKey, r: Row) {
  switch (k) {
    case "outreach": return r.onProject ? <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">On this project</span> : <OutreachPill o={r.founderOutreach} />;
    case "firm": return r.firm || "—";
    case "phone": return r.phone ? <span className="whitespace-nowrap">{r.phone}</span> : "—";
    case "email": return r.email ? <a href={`mailto:${r.email}`} className="text-indigo-700 hover:underline">{r.email}</a> : "—";
    case "fit": return r.fit < 0 ? <span className="text-slate-400">not scored</span> : <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TIER_CLS[r.tier]}`}>{r.fit}% · {r.tier}</span>;
    case "why": return r.summary;
    case "sectors": return r.sectors.length ? r.sectors.join(", ") : "—";
    case "types": return r.types.length ? r.types.join(", ") : "—";
    case "source": return srcLabel(r.dataSource);
    case "also": return r.alsoOn.length ? r.alsoOn.join(", ") : "—";
  }
}

// ── Header sorting ───────────────────────────────────────────────────────────
export type SortKey = "name" | ColKey;
/** null = the list's natural order (fit ranking, or A to Z for search). */
export type SortState = { key: SortKey; dir: "asc" | "desc" } | null;

/** One click A to Z, again Z to A, a third time back to the natural order. */
export function nextSort(s: SortState, key: SortKey): SortState {
  if (!s || s.key !== key) return { key, dir: "asc" };
  return s.dir === "asc" ? { key, dir: "desc" } : null;
}

function sortValue(r: Row, k: SortKey): string | number | null {
  const t = (v: string | null | undefined) => (v ?? "").trim() || null;
  switch (k) {
    case "name": return t(r.name ?? r.firm);
    case "firm": return t(r.firm);
    case "phone": return t((r.phone ?? "").replace(/\D/g, ""));
    case "email": return t(r.email);
    case "fit": return r.fit < 0 ? null : r.fit;
    case "why": return r.fit < 0 ? null : t(r.summary);
    case "sectors": return t(r.sectors.join(", "));
    case "types": return t(r.types.join(", "));
    case "source": return srcLabel(r.dataSource);
    case "also": return t(r.alsoOn.join(", "));
    case "outreach": return r.onProject ? IR_STAGES.length + 1 : r.founderOutreach ? IR_STAGES.indexOf(r.founderOutreach.stage) : null;
  }
}

/** Sorted copy. Blanks always go last, whichever direction. Numbers compare as numbers. */
export function sortRows(rows: Row[], s: SortState): Row[] {
  if (!s) return rows;
  const mul = s.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = sortValue(a, s.key); const y = sortValue(b, s.key);
    if (x === null && y === null) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    if (typeof x === "number" && typeof y === "number") return (x - y) * mul;
    return String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: "base" }) * mul;
  });
}

export function SortTh({ label, k, sort, onSort }: { label: string; k: SortKey; sort: SortState; onSort: (k: SortKey) => void }) {
  const on = sort?.key === k;
  return (
    <th className="py-2 pr-2 font-medium" aria-sort={on ? (sort!.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => onSort(k)} title="Sort" className={`inline-flex items-center gap-1 rounded px-1 -mx-1 hover:bg-slate-100 ${on ? "text-indigo-700" : ""}`}>
        {label}
        <i className={`ti ${on ? (sort!.dir === "asc" ? "ti-arrow-up" : "ti-arrow-down") : "ti-arrows-sort text-slate-300"}`} aria-hidden="true" />
      </button>
    </th>
  );
}
