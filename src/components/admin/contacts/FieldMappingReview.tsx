"use client";

import { useMemo, useState } from "react";
import { validateMapping, type ColumnMapping, type ColumnMatch, type CustomField } from "@/lib/contacts/field-mapping";

export type TargetOption = { key: string; label: string; group: "Contact" | "Company" };
export type ReviewResult = { mapping: ColumnMapping[]; decided: string[]; remember: boolean };

type Choice = { value: string; label: string | null }; // value: "" | "map:<key>" | "custom:<key>" | "new" | "ignore"

function choiceOf(m: ColumnMatch): Choice {
  if (m.status === "none") return { value: "", label: null };
  if (m.action === "map" && m.target) return { value: `map:${m.target}`, label: null };
  if (m.action === "custom" && m.customKey) return { value: `custom:${m.customKey}`, label: null };
  return { value: "ignore", label: null };
}

function toMapping(column: string, c: Choice): ColumnMapping {
  if (c.value.startsWith("map:")) return { column, action: "map", target: c.value.slice(4) };
  if (c.value.startsWith("custom:")) return { column, action: "custom", customKey: c.value.slice(7) };
  if (c.value === "new") return { column, action: "custom", customLabel: c.label ?? "" };
  return { column, action: "ignore" };
}

const STATUS_LABEL: Record<string, string> = { saved: "Saved mapping", exact: "Matched", alias: "Matched" };

/**
 * Field mapping review for a contact import. Columns that didn't match an iCapOS field are
 * listed first and must each be mapped, sent to a custom field, or skipped before Continue
 * goes through. Matched columns stay changeable behind "Show N matched".
 */
export function FieldMappingReview({ sourceLabel, fileName, rowCount, matches, targets, customFields, busy, error, onCancel, onContinue }: {
  sourceLabel: string;
  fileName: string;
  rowCount: number;
  matches: ColumnMatch[];
  targets: TargetOption[];
  customFields: CustomField[];
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onContinue: (r: ReviewResult) => void;
}) {
  const [choices, setChoices] = useState<Record<string, Choice>>(() => Object.fromEntries(matches.map((m) => [m.column, choiceOf(m)])));
  const [showMatched, setShowMatched] = useState(false);
  const [remember, setRemember] = useState(true);
  const [tried, setTried] = useState(false);

  const unmatched = matches.filter((m) => m.status === "none");
  const matched = matches.filter((m) => m.status !== "none");
  const decided = matches.filter((m) => choices[m.column]?.value).map((m) => m.column);
  const open = matches.length - decided.length;
  const mapping = useMemo(() => matches.map((m) => toMapping(m.column, choices[m.column] ?? { value: "", label: null })), [matches, choices]);
  const problems = useMemo(() => validateMapping(matches.map((m) => m.column), mapping, customFields.map((f) => f.key), new Set(decided)), [matches, mapping, customFields, decided]);
  const problemFor = (col: string) => problems.find((p) => p.column === col)?.message ?? null;
  const takenBy = (key: string, self: string) => matches.find((m) => m.column !== self && choices[m.column]?.value === `map:${key}`)?.column ?? null;

  function set(col: string, c: Choice) { setChoices((x) => ({ ...x, [col]: c })); }

  function row(m: ColumnMatch) {
    const c = choices[m.column] ?? { value: "", label: null };
    const err = tried ? problemFor(m.column) : null;
    const pill = m.status === "none"
      ? (c.value ? { bg: "#E6F1FB", fg: "#185FA5", text: "Decided" } : { bg: "#FAEEDA", fg: "#854F0B", text: "No match" })
      : { bg: "#E1F5EE", fg: "#0F6E56", text: STATUS_LABEL[m.status] };
    return (
      <div key={m.column} style={{ borderTop: "0.5px solid #eef1f5", padding: "10px 0", display: "grid", gridTemplateColumns: "minmax(0,1.1fr) minmax(0,1fr)", gap: 12, alignItems: "start" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", wordBreak: "break-word" }}>{m.column}</span>
            <span style={{ fontSize: 10.5, fontWeight: 500, background: pill.bg, color: pill.fg, borderRadius: 6, padding: "1px 7px" }}>{pill.text}</span>
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontSize: 11.5, color: "var(--muted-foreground)", marginTop: 3, wordBreak: "break-word" }}>
            {m.samples.length ? m.samples.map((s) => `"${s}"`).join(", ") : "No values in the first rows"}
          </div>
        </div>
        <div>
          <select value={c.value} disabled={busy} onChange={(e) => set(m.column, { value: e.target.value, label: e.target.value === "new" ? (c.label ?? m.column) : null })}
            aria-label={`iCapOS field for ${m.column}`}
            style={{ width: "100%", fontSize: 12.5, minHeight: 34, border: `0.5px solid ${err ? "#E24B4A" : "#cbd5e1"}`, borderRadius: 8, padding: "0 8px", background: "#fff", color: "var(--foreground)" }}>
            <option value="">Choose iCapOS field…</option>
            {(["Contact", "Company"] as const).map((g) => (
              <optgroup key={g} label={g}>
                {targets.filter((t) => t.group === g).map((t) => {
                  const by = takenBy(t.key, m.column);
                  return <option key={t.key} value={`map:${t.key}`} disabled={Boolean(by)}>{t.label}{by ? ` (used by ${by})` : ""}</option>;
                })}
              </optgroup>
            ))}
            {customFields.length > 0 && (
              <optgroup label="Custom fields">
                {customFields.map((f) => <option key={f.key} value={`custom:${f.key}`}>{f.label}</option>)}
              </optgroup>
            )}
            <option value="new">Create custom field…</option>
            <option value="ignore">Skip this column</option>
          </select>
          {c.value === "new" && (
            <input value={c.label ?? ""} disabled={busy} onChange={(e) => set(m.column, { value: "new", label: e.target.value })} placeholder="Custom field name"
              aria-label={`Custom field name for ${m.column}`}
              style={{ width: "100%", marginTop: 6, fontSize: 12.5, minHeight: 32, border: "0.5px solid #cbd5e1", borderRadius: 8, padding: "0 8px" }} />
          )}
          {err && <div style={{ fontSize: 11.5, color: "#A32D2D", marginTop: 4 }}>{err}</div>}
        </div>
      </div>
    );
  }

  const globalErr = tried ? problems.find((p) => !p.column)?.message ?? null : null;

  function submit() {
    setTried(true);
    if (problems.length) return;
    onContinue({ mapping, decided, remember });
  }

  return (
    <div onClick={() => { if (!busy) onCancel(); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Review field mapping"
        style={{ background: "#fff", borderRadius: 12, padding: 16, width: 640, maxWidth: "100%", maxHeight: "calc(100vh - 32px)", overflowY: "auto", boxShadow: "0 20px 48px rgba(0,0,0,.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Review field mapping</div>
          <span style={{ fontSize: 11, fontWeight: 500, background: "#E6F1FB", color: "#185FA5", borderRadius: 6, padding: "2px 8px" }}>{sourceLabel} · {rowCount.toLocaleString()} rows</span>
        </div>
        <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "4px 0 10px", wordBreak: "break-word" }}>{fileName}. Values are stored exactly as they are in the file. The mapping only decides which field each column goes to.</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8, marginBottom: 6 }}>
          <div style={{ background: "var(--muted)", borderRadius: 8, padding: 10 }}><div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Matched</div><div style={{ fontSize: 22, fontWeight: 600 }}>{matched.length}</div></div>
          <div style={{ background: open ? "#FAEEDA" : "var(--muted)", borderRadius: 8, padding: 10 }}><div style={{ fontSize: 11, color: open ? "#854F0B" : "var(--muted-foreground)" }}>Needs your decision</div><div style={{ fontSize: 22, fontWeight: 600, color: open ? "#854F0B" : undefined }}>{open}</div></div>
        </div>

        {unmatched.map(row)}

        {matched.length > 0 && (
          <div style={{ borderTop: "0.5px solid #eef1f5", paddingTop: 8 }}>
            <button type="button" onClick={() => setShowMatched((v) => !v)} style={{ fontSize: 12, color: "#185FA5", background: "none", border: "none", padding: 0, cursor: "pointer" }}>
              <i className={`ti ${showMatched ? "ti-chevron-up" : "ti-chevron-down"}`} aria-hidden="true" /> {showMatched ? "Hide" : "Show"} {matched.length} matched column{matched.length === 1 ? "" : "s"}
            </button>
            {showMatched && matched.map(row)}
          </div>
        )}

        <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: "10px 0 0" }}>Tags, assignees and lead status aren&rsquo;t offered: mapping into them would change the value&rsquo;s format. Use a custom field instead. Contact type keeps today&rsquo;s rule (Founder, Investor, Advisor, Other), and the original text is kept with the contact.</p>

        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, margin: "10px 0 0" }}>
          <input type="checkbox" checked={remember} disabled={busy} onChange={(e) => setRemember(e.target.checked)} /> Remember these mappings for the next {sourceLabel.toLowerCase()}
        </label>

        {(globalErr || error) && <div style={{ fontSize: 12, color: "#A32D2D", marginTop: 8 }}>{globalErr ?? error}</div>}
        {tried && !globalErr && problems.length > 0 && <div style={{ fontSize: 12, color: "#A32D2D", marginTop: 8 }}>Choose a field or skip for {problems.length} column{problems.length === 1 ? "" : "s"}.</div>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
          <button type="button" onClick={onCancel} disabled={busy} style={{ fontSize: 12, color: "var(--muted-foreground)", background: "transparent", border: "0.5px solid #cdd9ec", borderRadius: 8, padding: "7px 13px", cursor: "pointer" }}>Cancel</button>
          <button type="button" onClick={submit} disabled={busy} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 8, padding: "7px 15px", cursor: "pointer", opacity: busy ? 0.6 : 1 }}>{busy ? "Checking…" : "Continue"}</button>
        </div>
      </div>
    </div>
  );
}
