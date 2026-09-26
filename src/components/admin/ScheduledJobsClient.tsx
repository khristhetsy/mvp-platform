"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { OdooSearchBar, EMPTY_SEARCH, type SearchState } from "@/components/admin/OdooSearchBar";
import { SearchCount, Highlight, NoSearchMatches } from "@/components/ui/SearchStatus";
import { matchRows, type SearchField } from "@/lib/ui/live-search";
import { ToolbarGear, downloadCsv, type GearItem } from "@/components/admin/ToolbarGear";
import { SelectionBar, ActionResult } from "@/components/admin/sales/SelectionBar";
import { CRON_GROUP_ORDER } from "@/lib/cron/jobs";

export type JobRow = {
  path: string;
  name: string;
  group: string;
  description: string | null;
  schedule: string;
  next: string | null;
  last: { tone: "success" | "error" | "warning" | "neutral"; text: string; detail?: string | null } | null;
  paused: { byName: string | null; when: string } | null;
};

const QUICK = [
  { key: "paused", label: "Paused" },
  { key: "active", label: "Active" },
  { key: "failed", label: "Failed or timed out", sep: true },
  { key: "never", label: "Not run yet" },
];
const GROUPS = [
  { id: "group", label: "Group" },
  { id: "none", label: "None" },
];

/** Every column the table shows, so a search can't miss what's on screen. */
const SEARCH_FIELDS: SearchField<JobRow>[] = [
  { label: "job", get: (r) => r.name },
  { label: "description", get: (r) => r.description },
  { label: "path", get: (r) => r.path },
  { label: "group", get: (r) => r.group },
  { label: "schedule", get: (r) => r.schedule },
  { label: "next run", get: (r) => r.next },
  { label: "last result", get: (r) => r.last?.text ?? "Not run yet" },
  { label: "paused by", get: (r) => (r.paused ? `Paused by ${r.paused.byName ?? "staff"}` : null) },
];

const TONE: Record<string, { color: string; bg: string }> = {
  success: { color: "#27500A", bg: "#EAF3DE" },
  error: { color: "#791F1F", bg: "#FCEBEB" },
  warning: { color: "#633806", bg: "#FAEEDA" },
  neutral: { color: "#5F5E5A", bg: "#F1EFE8" },
};

type Confirm = { paths: string[]; names: string[] };

export function ScheduledJobsClient({ rows }: { rows: JobRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState<SearchState>({ ...EMPTY_SEARCH, groupBy: "group" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const groupOptions = useMemo(() => CRON_GROUP_ORDER.filter((g) => rows.some((r) => r.group === g)), [rows]);
  const fields = useMemo(() => [{ key: "group", label: "Group", options: groupOptions }], [groupOptions]);

  // Quick filters and the group field narrow first; the typed text then filters
  // what's left, so the count reads "3 of 23 jobs" against the whole list.
  const filtered = useMemo(() => {
    const { quick, fields: f } = search;
    return rows.filter((r) => {
      if (quick.includes("paused") && !r.paused) return false;
      if (quick.includes("active") && r.paused) return false;
      if (quick.includes("failed") && r.last?.tone !== "error") return false;
      if (quick.includes("never") && r.last) return false;
      if (f.group?.length && !f.group.includes(r.group)) return false;
      return true;
    });
  }, [rows, search]);
  const searched = useMemo(() => {
    const r = matchRows(filtered, SEARCH_FIELDS, search.q);
    return { ...r, total: rows.length };
  }, [filtered, search.q, rows.length]);
  const visible = searched.rows;
  const query = search.q;

  const grouped = useMemo(() => {
    if ((search.groupBy || "group") === "none") return [["", visible] as const];
    return CRON_GROUP_ORDER.map((g) => [g, visible.filter((r) => r.group === g)] as const).filter(([, list]) => list.length > 0);
  }, [visible, search.groupBy]);

  async function save(paths: string[], paused: boolean) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/scheduled-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths, paused }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setResult(body?.error ?? "Couldn't save. Try again.");
        return;
      }
      setResult(`${paths.length} job${paths.length === 1 ? "" : "s"} ${paused ? "paused" : "resumed"}`);
      setSelected(new Set());
      router.refresh();
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  const askPause = (list: JobRow[]) => {
    const targets = list.filter((r) => !r.paused);
    if (targets.length) setConfirm({ paths: targets.map((r) => r.path), names: targets.map((r) => r.name) });
  };
  const resume = (list: JobRow[]) => {
    const targets = list.filter((r) => r.paused).map((r) => r.path);
    if (targets.length) void save(targets, false);
  };

  const selectedRows = rows.filter((r) => selected.has(r.path));
  const toggleRow = (p: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(p)) n.delete(p);
      else n.add(p);
      return n;
    });

  const gear: GearItem[] = [
    {
      key: "export",
      icon: "ti-download",
      label: "Export all",
      hint: `${visible.length} jobs`,
      onClick: () =>
        downloadCsv(
          `scheduled-jobs-${new Date().toISOString().slice(0, 10)}.csv`,
          ["Job", "Group", "Path", "Schedule", "Next run", "Last result", "Paused"],
          visible.map((r) => [r.name, r.group, r.path, r.schedule, r.next ?? "", r.last?.text ?? "Not run yet", r.paused ? `Yes, by ${r.paused.byName ?? "staff"} ${r.paused.when}` : "No"]),
        ),
    },
  ];

  const cell: React.CSSProperties = { padding: "10px 12px", fontSize: 13, verticalAlign: "top" };

  return (
    <div>
      <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "0.5px solid #eef1f5", flexWrap: "wrap" }}>
          <ToolbarGear heading="Scheduled jobs" items={gear} />
          <OdooSearchBar scope="scheduled-jobs" state={search} onChange={setSearch} quick={QUICK} fields={fields} groups={GROUPS} noGroupId="none" placeholder="Search jobs" width={440} />
          <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 10 }}>
            <SearchCount result={{ ...searched, active: searched.active || filtered.length !== rows.length }} noun="jobs" />
            <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{rows.filter((r) => r.paused).length} paused</span>
          </span>
        </div>

        <SelectionBar
          count={selected.size}
          total={visible.length}
          onSelectAll={() => setSelected(new Set(visible.map((r) => r.path)))}
          onClear={() => setSelected(new Set())}
          busy={busy}
          heading="Scheduled jobs"
          actions={[
            { key: "pause", icon: "ti-player-pause", label: "Pause", danger: true, run: () => askPause(selectedRows) },
            { key: "resume", icon: "ti-player-play", label: "Resume", run: () => resume(selectedRows) },
          ]}
        />
        <ActionResult text={result} onClose={() => setResult(null)} />

        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <thead>
            <tr style={{ textAlign: "left", fontSize: 12, color: "var(--muted-foreground)", borderBottom: "0.5px solid #eef1f5" }}>
              <th style={{ ...cell, width: 36 }}>
                <input
                  type="checkbox"
                  aria-label="Select all jobs"
                  checked={visible.length > 0 && visible.every((r) => selected.has(r.path))}
                  onChange={(e) => setSelected(e.target.checked ? new Set(visible.map((r) => r.path)) : new Set())}
                />
              </th>
              <th style={{ ...cell, fontWeight: 500 }}>Job</th>
              <th style={{ ...cell, fontWeight: 500, width: "24%" }}>Schedule and next run</th>
              <th style={{ ...cell, fontWeight: 500, width: "24%" }}>Last result</th>
              <th style={{ ...cell, fontWeight: 500, width: 72 }}>Active</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 12 }}>
                  {query.trim() ? (
                    <NoSearchMatches query={query} fields={SEARCH_FIELDS.map((f) => f.label)} onClear={() => setSearch({ ...search, q: "" })} />
                  ) : (
                    <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>No jobs match these filters.</span>
                  )}
                </td>
              </tr>
            )}
            {grouped.map(([group, list]) => (
              <GroupRows
                key={group || "all"}
                group={group}
                list={list}
                collapsed={collapsed.has(group)}
                onToggleGroup={() =>
                  setCollapsed((c) => {
                    const n = new Set(c);
                    if (n.has(group)) n.delete(group);
                    else n.add(group);
                    return n;
                  })
                }
                selected={selected}
                onToggleRow={toggleRow}
                onSwitch={(r) => (r.paused ? resume([r]) : askPause([r]))}
                busy={busy}
                cell={cell}
                query={query}
              />
            ))}
          </tbody>
        </table>
      </div>

      {confirm && (
        <div onClick={() => !busy && setConfirm(null)} style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(4,12,28,.5)", padding: 16 }}>
          <div role="dialog" aria-label="Pause scheduled jobs" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 440, background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 16, padding: 20, boxShadow: "0 12px 40px rgba(12,35,64,.22)" }}>
            <p style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 600 }}>
              Pause {confirm.names.length === 1 ? confirm.names[0] : `${confirm.names.length} jobs`}?
            </p>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.6 }}>
              {confirm.names.length > 1 ? `${confirm.names.join(", ")}. ` : ""}
              The job keeps waking up on schedule but skips its work until you resume it. Nothing already sent is undone.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" disabled={busy} onClick={() => setConfirm(null)} style={{ fontSize: 13, background: "#fff", border: "0.5px solid #cbd5e1", borderRadius: 8, padding: "7px 14px", cursor: "pointer" }}>Cancel</button>
              <button type="button" disabled={busy} onClick={() => void save(confirm.paths, true)} style={{ fontSize: 13, fontWeight: 600, color: "#fff", background: "#A32D2D", border: "none", borderRadius: 8, padding: "7px 14px", cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
                {busy ? "Pausing…" : "Pause"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GroupRows({
  group, list, collapsed, onToggleGroup, selected, onToggleRow, onSwitch, busy, cell, query,
}: {
  group: string; list: readonly JobRow[]; collapsed: boolean; onToggleGroup: () => void;
  selected: Set<string>; onToggleRow: (p: string) => void; onSwitch: (r: JobRow) => void; busy: boolean; cell: React.CSSProperties;
  query: string;
}) {
  return (
    <>
      {group && (
        <tr style={{ background: "#FAFBFD", borderTop: "0.5px solid #eef1f5" }}>
          <td colSpan={5} style={{ padding: "7px 12px" }}>
            <button type="button" onClick={onToggleGroup} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <i className={`ti ti-chevron-${collapsed ? "right" : "down"}`} aria-hidden="true" />
              <Highlight text={group} query={query} /> <span style={{ fontWeight: 400 }}>{list.length}</span>
            </button>
          </td>
        </tr>
      )}
      {!collapsed &&
        list.map((r) => {
          const tone = r.last ? TONE[r.last.tone]! : TONE.neutral!;
          return (
            <tr key={r.path} style={{ borderTop: "0.5px solid #eef1f5", background: r.paused ? "#FFFBF3" : undefined }}>
              <td style={cell}>
                <input type="checkbox" aria-label={`Select ${r.name}`} checked={selected.has(r.path)} onChange={() => onToggleRow(r.path)} />
              </td>
              <td style={cell}>
                <div style={{ fontWeight: 500, color: "var(--foreground)" }}><Highlight text={r.name} query={query} /></div>
                {r.paused ? (
                  <div style={{ fontSize: 12, color: "#854F0B" }}><Highlight text={`Paused by ${r.paused.byName ?? "staff"}`} query={query} /> · {r.paused.when}</div>
                ) : r.description ? (
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}><Highlight text={r.description} query={query} /></div>
                ) : null}
                <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "var(--font-mono, monospace)" }}><Highlight text={r.path} query={query} /></div>
              </td>
              <td style={cell}>
                <div><Highlight text={r.schedule} query={query} /></div>
                {r.next && <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Next <Highlight text={r.next} query={query} /></div>}
              </td>
              <td style={cell}>
                <span title={r.last?.detail ?? undefined} style={{ display: "inline-block", fontSize: 12, padding: "2px 8px", borderRadius: 6, color: tone.color, background: tone.bg }}>
                  <Highlight text={r.last?.text ?? "Not run yet"} query={query} />
                </span>
              </td>
              <td style={cell}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!r.paused}
                  aria-label={`${r.paused ? "Resume" : "Pause"} ${r.name}`}
                  disabled={busy}
                  onClick={() => onSwitch(r)}
                  style={{ position: "relative", width: 34, height: 20, borderRadius: 10, border: "none", cursor: "pointer", background: r.paused ? "#cbd5e1" : "#3B6D11", opacity: busy ? 0.6 : 1 }}
                >
                  <span style={{ position: "absolute", top: 3, left: r.paused ? 3 : 17, width: 14, height: 14, borderRadius: "50%", background: "#fff", transition: "left .15s" }} />
                </button>
              </td>
            </tr>
          );
        })}
    </>
  );
}
