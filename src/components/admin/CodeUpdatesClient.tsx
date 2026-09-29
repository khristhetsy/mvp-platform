"use client";

import { useMemo, useState } from "react";
import { OdooSearchBar, EMPTY_SEARCH, type SearchState } from "@/components/admin/OdooSearchBar";
import { SearchCount, Highlight, NoSearchMatches } from "@/components/ui/SearchStatus";
import { matchRows, type SearchField } from "@/lib/ui/live-search";
import { ToolbarGear, downloadCsv, type GearItem } from "@/components/admin/ToolbarGear";
import { SelectionBar } from "@/components/admin/sales/SelectionBar";

/** One change from the code updates queue, as shown on Admin, System, Scheduled jobs. */
export type CodeUpdateRow = {
  id: number;
  title: string;
  /** Live (pushed to main), Waiting, Failed, or the raw queue status. */
  status: string;
  queued: string;
  applied: string | null;
  sha: string | null;
  note: string | null;
};

const REPO_COMMIT = "https://github.com/khristhetsy/mvp-platform/commit/";

const QUICK = [
  { key: "waiting", label: "Waiting" },
  { key: "live", label: "Live" },
  { key: "failed", label: "Failed" },
];
const GROUPS = [
  { id: "none", label: "None" },
  { id: "status", label: "Status" },
];
const STATUS_ORDER = ["Waiting", "Failed", "Live"];

const SEARCH_FIELDS: SearchField<CodeUpdateRow>[] = [
  { label: "number", get: (r) => String(r.id) },
  { label: "update", get: (r) => r.title },
  { label: "status", get: (r) => r.status },
  { label: "commit", get: (r) => r.sha },
  { label: "note", get: (r) => r.note },
];

const TONE: Record<string, { color: string; bg: string }> = {
  Live: { color: "#27500A", bg: "#EAF3DE" },
  Waiting: { color: "#633806", bg: "#FAEEDA" },
  Failed: { color: "#791F1F", bg: "#FCEBEB" },
};
const NEUTRAL = { color: "#5F5E5A", bg: "#F1EFE8" };

function exportRows(list: CodeUpdateRow[]) {
  downloadCsv(
    `code-updates-${new Date().toISOString().slice(0, 10)}.csv`,
    ["#", "Update", "Status", "Queued", "Applied", "Commit", "Note"],
    list.map((r) => [String(r.id), r.title, r.status, r.queued, r.applied ?? "", r.sha ?? "", r.note ?? ""]),
  );
}

export function CodeUpdatesClient({ rows }: { rows: CodeUpdateRow[] }) {
  const [search, setSearch] = useState<SearchState>({ ...EMPTY_SEARCH, groupBy: "none" });
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const filtered = useMemo(() => {
    const q = search.quick;
    if (!q.length) return rows;
    return rows.filter((r) => (q.includes("waiting") && r.status === "Waiting") || (q.includes("live") && r.status === "Live") || (q.includes("failed") && r.status === "Failed"));
  }, [rows, search.quick]);
  const searched = useMemo(() => ({ ...matchRows(filtered, SEARCH_FIELDS, search.q), total: rows.length }), [filtered, search.q, rows.length]);
  const visible = searched.rows;
  const query = search.q;

  const grouped = useMemo(() => {
    if (search.groupBy !== "status") return [["", visible] as const];
    const known = STATUS_ORDER.map((s) => [s, visible.filter((r) => r.status === s)] as const);
    const other = visible.filter((r) => !STATUS_ORDER.includes(r.status));
    return [...known, ["Other", other] as const].filter(([, list]) => list.length > 0);
  }, [visible, search.groupBy]);

  const gear: GearItem[] = [
    { key: "export", icon: "ti-download", label: "Export all", hint: `${visible.length} updates`, onClick: () => exportRows(visible) },
  ];

  const cell: React.CSSProperties = { padding: "10px 12px", fontSize: 13, verticalAlign: "top" };

  return (
    <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "0.5px solid #eef1f5", flexWrap: "wrap" }}>
        <ToolbarGear heading="Code updates" items={gear} />
        <OdooSearchBar scope="code-updates" state={search} onChange={setSearch} quick={QUICK} fields={[]} groups={GROUPS} noGroupId="none" placeholder="Search updates" width={440} />
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 10 }}>
          <SearchCount result={{ ...searched, active: searched.active || filtered.length !== rows.length }} noun="updates" />
        </span>
      </div>

      <SelectionBar
        count={selected.size}
        total={visible.length}
        onSelectAll={() => setSelected(new Set(visible.map((r) => r.id)))}
        onClear={() => setSelected(new Set())}
        heading="Code updates"
        actions={[{ key: "export", icon: "ti-download", label: "Export selected", run: () => exportRows(rows.filter((r) => selected.has(r.id))) }]}
      />

      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
        <thead>
          <tr style={{ textAlign: "left", fontSize: 12, color: "var(--muted-foreground)", borderBottom: "0.5px solid #eef1f5" }}>
            <th style={{ ...cell, width: 36 }}>
              <input
                type="checkbox"
                aria-label="Select all updates"
                checked={visible.length > 0 && visible.every((r) => selected.has(r.id))}
                onChange={(e) => setSelected(e.target.checked ? new Set(visible.map((r) => r.id)) : new Set())}
              />
            </th>
            <th style={{ ...cell, fontWeight: 500, width: 52 }}>#</th>
            <th style={{ ...cell, fontWeight: 500 }}>Update</th>
            <th style={{ ...cell, fontWeight: 500, width: "22%" }}>Status</th>
            <th style={{ ...cell, fontWeight: 500, width: 110 }}>Commit</th>
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 && (
            <tr>
              <td colSpan={5} style={{ padding: 12 }}>
                {query.trim() ? (
                  <NoSearchMatches query={query} fields={SEARCH_FIELDS.map((f) => f.label)} onClear={() => setSearch({ ...search, q: "" })} />
                ) : (
                  <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>No code updates match these filters.</span>
                )}
              </td>
            </tr>
          )}
          {grouped.map(([group, list]) => (
            <GroupRows key={group || "all"} group={group} list={list} selected={selected} setSelected={setSelected} cell={cell} query={query} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GroupRows({
  group, list, selected, setSelected, cell, query,
}: {
  group: string; list: readonly CodeUpdateRow[]; selected: Set<number>;
  setSelected: React.Dispatch<React.SetStateAction<Set<number>>>; cell: React.CSSProperties; query: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <>
      {group && (
        <tr style={{ background: "#FAFBFD", borderTop: "0.5px solid #eef1f5" }}>
          <td colSpan={5} style={{ padding: "7px 12px" }}>
            <button type="button" onClick={() => setCollapsed((c) => !c)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <i className={`ti ti-chevron-${collapsed ? "right" : "down"}`} aria-hidden="true" />
              {group} <span style={{ fontWeight: 400 }}>{list.length}</span>
            </button>
          </td>
        </tr>
      )}
      {!collapsed &&
        list.map((r) => {
          const tone = TONE[r.status] ?? NEUTRAL;
          return (
            <tr key={r.id} style={{ borderTop: "0.5px solid #eef1f5" }}>
              <td style={cell}>
                <input
                  type="checkbox"
                  aria-label={`Select update ${r.id}`}
                  checked={selected.has(r.id)}
                  onChange={() =>
                    setSelected((s) => {
                      const n = new Set(s);
                      if (n.has(r.id)) n.delete(r.id);
                      else n.add(r.id);
                      return n;
                    })
                  }
                />
              </td>
              <td style={{ ...cell, color: "var(--muted-foreground)" }}><Highlight text={String(r.id)} query={query} /></td>
              <td style={cell}>
                <div style={{ fontWeight: 500, color: "var(--foreground)" }}><Highlight text={r.title} query={query} /></div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                  Queued {r.queued}
                  {r.applied ? ` · applied ${r.applied}` : ""}
                </div>
                {r.note && r.status !== "Live" ? (
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}><Highlight text={r.note} query={query} /></div>
                ) : null}
              </td>
              <td style={cell}>
                <span style={{ display: "inline-block", fontSize: 12, padding: "2px 8px", borderRadius: 6, color: tone.color, background: tone.bg }}>
                  <Highlight text={r.status} query={query} />
                </span>
              </td>
              <td style={{ ...cell, fontFamily: "var(--font-mono, monospace)", fontSize: 12 }}>
                {r.sha ? (
                  <a href={`${REPO_COMMIT}${r.sha}`} target="_blank" rel="noreferrer" style={{ color: "#185FA5" }}>
                    <Highlight text={r.sha} query={query} />
                  </a>
                ) : (
                  <span style={{ color: "#94a3b8" }}>·</span>
                )}
              </td>
            </tr>
          );
        })}
    </>
  );
}
