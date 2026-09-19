"use client";

/**
 * Odoo-style unified search bar for admin lists that filter CLIENT-SIDE.
 *
 * One box holds the typed search, the active filters as chips, and a three-column
 * dropdown (Filters / Group by / Favorites). The page owns the state (`SearchState`) and
 * applies it to its rows; this component only renders and edits that state. Favorites
 * are saved per `scope` in marketing_saved_searches (migration 20260913003).
 *
 * The Contacts grids keep their own richer bar (server-side filter spec) in
 * SalesContactsClient — deliberately not shared, that one is working.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export type SearchState = {
  /** Free text; the page decides which fields it matches. */
  q: string;
  /** Keys of the toggled quick filters. */
  quick: string[];
  /** Multi-select field filters: field key → chosen values. */
  fields: Record<string, string[]>;
  /** Group-by option id ("" or the page's "none" id when not grouped). */
  groupBy: string;
};
export const EMPTY_SEARCH: SearchState = { q: "", quick: [], fields: {}, groupBy: "" };

export type QuickFilter = { key: string; label: string; /** Section break before this item. */ sep?: boolean };
export type FieldFilter = { key: string; label: string; options: string[] };
export type GroupOption = { id: string; label: string };

export type SavedView = {
  id: string; name: string; state: SearchState; isDefault: boolean; isShared: boolean; mine: boolean; ownerName?: string; canDelete?: boolean;
};

type Props = {
  scope: string;
  state: SearchState;
  onChange: (next: SearchState) => void;
  quick: QuickFilter[];
  fields: FieldFilter[];
  groups: GroupOption[];
  /** Group id that means "not grouped" (chip hidden). Default "". */
  noGroupId?: string;
  placeholder?: string;
  /** Apply the owner's default favorite once on mount (default true). */
  applyDefault?: boolean;
  /** Width of the bar; the dropdown anchors to its right edge. */
  width?: number | string;
  /**
   * Where favorites live. Founders use a founder-scoped endpoint that only ever
   * touches the caller's own rows — one founder must never see another's views.
   */
  api?: string;
  /** Hide the shared-filters section and the "share with team" box (founder lists). */
  personalOnly?: boolean;
};

const chipBase: React.CSSProperties = { display: "inline-flex", alignItems: "center", borderRadius: 6, overflow: "hidden", fontSize: 11.5 };
const item: React.CSSProperties = { display: "block", width: "100%", textAlign: "left", padding: "6px 12px 6px 26px", fontSize: 12.5, background: "none", border: "none", cursor: "pointer", color: "var(--foreground)" };

function Chip({ text, color, bg, border, onRemove, icon }: { text: string; color: string; bg: string; border: string; onRemove: () => void; icon?: string }) {
  return (
    <span style={{ ...chipBase, border: `0.5px solid ${border}`, background: bg }}>
      <span style={{ padding: "3px 8px", color, display: "inline-flex", alignItems: "center", gap: 4 }}>{icon && <i className={`ti ${icon}`} aria-hidden="true" />}{text}</span>
      <button type="button" onClick={onRemove} aria-label={`Remove ${text}`} style={{ border: "none", background: border, color, padding: "3px 6px", cursor: "pointer" }}>×</button>
    </span>
  );
}

export function OdooSearchBar({ scope, state, onChange, quick, fields, groups, noGroupId = "", placeholder = "Search…", applyDefault = true, width = 560, api = "/api/marketing/saved-searches", personalOnly = false }: Props) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [openField, setOpenField] = useState<string | null>(null);
  const [fieldQ, setFieldQ] = useState("");
  const [saved, setSaved] = useState<SavedView[]>([]);
  const [applied, setApplied] = useState<SavedView | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveDefault, setSaveDefault] = useState(false);
  const [saveShared, setSaveShared] = useState(false);
  const defaultApplied = useRef(false);

  const fetchSaved = useCallback(async () => {
    try {
      const r = await fetch(`${api}?scope=${encodeURIComponent(scope)}`);
      if (!r.ok) return;
      const rows = ((await r.json()).searches ?? []) as Array<Record<string, unknown>>;
      setSaved(rows.map((s) => ({
        id: String(s.id), name: String(s.name), isDefault: !!s.isDefault, isShared: !!s.isShared, mine: !!s.mine,
        ownerName: s.ownerName as string | undefined, canDelete: s.canDelete as boolean | undefined,
        state: { ...EMPTY_SEARCH, ...(((s.spec as { state?: Partial<SearchState> } | null)?.state) ?? {}) },
      })));
    } catch { /* ignore */ }
  }, [scope, api]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch sets state later
  useEffect(() => { void fetchSaved(); }, [fetchSaved]);
  useEffect(() => {
    if (!applyDefault || defaultApplied.current) return;
    const def = saved.find((s) => s.isDefault && s.mine);
    if (!def) return;
    defaultApplied.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time default apply
    setApplied(def);
    onChange(def.state);
  }, [saved, applyDefault, onChange]);

  const set = (patch: Partial<SearchState>) => { setApplied(null); onChange({ ...state, ...patch }); };
  const toggleQuick = (k: string) => set({ quick: state.quick.includes(k) ? state.quick.filter((x) => x !== k) : [...state.quick, k] });
  const toggleValue = (f: string, v: string) => {
    const cur = state.fields[f] ?? [];
    const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
    const copy = { ...state.fields };
    if (next.length) copy[f] = next; else delete copy[f];
    set({ fields: copy });
  };
  const clearAll = () => { setApplied(null); onChange({ ...EMPTY_SEARCH, groupBy: noGroupId }); };
  const hasAny = !!state.q || state.quick.length > 0 || Object.keys(state.fields).length > 0 || (state.groupBy && state.groupBy !== noGroupId);

  async function saveCurrent() {
    if (!saveName.trim()) return;
    try {
      await fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        scope, name: saveName.trim(), spec: { match: "all", conditions: [], state }, groupBy: state.groupBy || null, isDefault: saveDefault, isShared: saveShared,
      }) });
      setSaveOpen(false); setSaveName(""); setSaveDefault(false); setSaveShared(false); setOpen(false);
      await fetchSaved();
    } catch { /* ignore */ }
  }
  async function deleteSaved(s: SavedView) {
    if (!window.confirm(`Delete saved search “${s.name}”?`)) return;
    try { await fetch(`${api}/${s.id}`, { method: "DELETE" }); if (applied?.id === s.id) setApplied(null); await fetchSaved(); } catch { /* ignore */ }
  }
  function applySaved(s: SavedView) { setApplied(s); onChange({ ...EMPTY_SEARCH, ...s.state }); setOpen(false); }

  const quickLabel = (k: string) => quick.find((q) => q.key === k)?.label ?? k;
  const fieldLabel = (k: string) => fields.find((f) => f.key === k)?.label ?? k;
  const groupLabel = groups.find((g) => g.id === state.groupBy)?.label ?? "";
  const mine = saved.filter((s) => s.mine);
  const shared = saved.filter((s) => !s.mine && s.isShared);

  const favRow = (s: SavedView) => (
    <div key={s.id} style={{ display: "flex", alignItems: "center" }}>
      <button type="button" onClick={() => applySaved(s)} style={{ ...item, flex: 1, paddingRight: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: applied?.id === s.id ? "#7A5AA8" : "var(--foreground)" }}>
        {applied?.id === s.id ? <i className="ti ti-check" style={{ marginRight: 4 }} aria-hidden="true" /> : <i className="ti ti-star" style={{ color: "#7A5AA8", marginRight: 4 }} aria-hidden="true" />}{s.name}
        {s.mine && s.isDefault ? <span style={{ color: "var(--muted-foreground)", fontSize: 11 }}> · default</span> : null}
        {!s.mine ? <span style={{ color: "var(--muted-foreground)", fontSize: 11 }}> · {s.ownerName ?? "Staff"}</span> : s.isShared ? <span style={{ color: "var(--muted-foreground)", fontSize: 11 }}> · shared</span> : null}
      </button>
      {(s.canDelete ?? s.mine) && <button type="button" onClick={() => deleteSaved(s)} aria-label={`Delete ${s.name}`} title="Delete" style={{ border: "none", background: "none", color: "#A32D2D", cursor: "pointer", padding: "0 10px" }}><i className="ti ti-trash" style={{ fontSize: 13 }} aria-hidden="true" /></button>}
    </div>
  );

  return (
    <div style={{ position: "relative", flex: `0 1 ${typeof width === "number" ? `${width}px` : width}`, minWidth: 260 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, border: "1px solid #cdd9ec", borderRadius: 9, padding: "5px 8px", background: "#fff", flexWrap: "wrap" }}>
        <i className="ti ti-search" style={{ color: "var(--muted-foreground)", fontSize: 14 }} aria-hidden="true" />
        {applied && <Chip icon="ti-star" text={applied.name} color="#3C3489" bg="#EEEDFE" border="#CECBF6" onRemove={clearAll} />}
        {state.q && <Chip text={`Search: ${state.q}`} color="#0C447C" bg="#E6F1FB" border="#B5D4F4" onRemove={() => set({ q: "" })} />}
        {state.quick.map((k) => <Chip key={k} text={quickLabel(k)} color="#0C447C" bg="#E6F1FB" border="#B5D4F4" onRemove={() => toggleQuick(k)} />)}
        {Object.entries(state.fields).map(([f, vals]) => <Chip key={f} text={`${fieldLabel(f)}: ${vals.join(", ")}`} color="#0C447C" bg="#E6F1FB" border="#B5D4F4" onRemove={() => { const copy = { ...state.fields }; delete copy[f]; set({ fields: copy }); }} />)}
        {state.groupBy && state.groupBy !== noGroupId && <Chip icon="ti-layout-list" text={groupLabel} color="#633806" bg="#FAEEDA" border="#E3C08A" onRemove={() => set({ groupBy: noGroupId })} />}
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && typed.trim()) { set({ q: typed.trim() }); setTyped(""); setOpen(false); }
            if (e.key === "Backspace" && !typed && state.q) set({ q: "" });
          }}
          placeholder={hasAny ? "" : placeholder}
          style={{ flex: 1, minWidth: 90, border: "none", outline: "none", fontSize: 13, padding: "4px 2px", background: "transparent" }}
        />
        <button type="button" onClick={() => setOpen((v) => !v)} aria-label="Toggle search options" style={{ border: "none", background: "none", color: "#2E78F5", cursor: "pointer", fontSize: 14 }}><i className={`ti ti-chevron-${open ? "up" : "down"}`} aria-hidden="true" /></button>
      </div>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 25 }} />
          <div style={{ position: "absolute", top: "calc(100% + 5px)", right: 0, width: typed.trim() ? "100%" : 620, maxWidth: "calc(100vw - 48px)", zIndex: 30, background: "#fff", border: "0.5px solid #cbd5e1", borderRadius: 10, boxShadow: "0 14px 30px rgba(0,0,0,.14)", overflow: "hidden" }}>
            {typed.trim() ? (
              <div style={{ padding: "4px 0" }}>
                <button type="button" onClick={() => { set({ q: typed.trim() }); setTyped(""); setOpen(false); }} style={{ ...item, paddingLeft: 12 }}>Search for: <span style={{ color: "#185FA5" }}>{typed.trim()}</span></button>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.15fr", alignItems: "start" }}>
                <div style={{ borderRight: "0.5px solid #eef1f5" }}>
                  <div style={{ padding: "9px 12px", fontSize: 11, fontWeight: 600, color: "#185FA5" }}><i className="ti ti-filter" aria-hidden="true" /> FILTERS</div>
                  {quick.map((qf) => {
                    const on = state.quick.includes(qf.key);
                    return (
                      <div key={qf.key}>
                        {qf.sep && <div style={{ borderTop: "0.5px solid #eef1f5", margin: "5px 0" }} />}
                        <button type="button" onClick={() => toggleQuick(qf.key)} style={{ ...item, background: on ? "#EEF4FF" : "none", color: on ? "#185FA5" : "var(--foreground)" }}>{on ? "✓ " : ""}{qf.label}</button>
                      </div>
                    );
                  })}
                  {fields.length > 0 && <div style={{ borderTop: "0.5px solid #eef1f5", margin: "5px 0" }} />}
                  {fields.map((f) => {
                    const isOpen = openField === f.key;
                    const n = (state.fields[f.key] ?? []).length;
                    const opts = f.options.filter((o) => o.toLowerCase().includes(fieldQ.toLowerCase()));
                    return (
                      <div key={f.key}>
                        <button type="button" onClick={() => { setOpenField(isOpen ? null : f.key); setFieldQ(""); }} style={{ ...item, display: "flex", alignItems: "center", gap: 6, color: n ? "#185FA5" : "var(--foreground)" }}>
                          <span style={{ flex: 1 }}>{f.label}</span>
                          {n > 0 && <span style={{ fontSize: 10.5, color: "#185FA5", background: "#E6F1FB", borderRadius: 10, padding: "0 7px" }}>{n}</span>}
                          <i className={`ti ti-chevron-${isOpen ? "down" : "right"}`} style={{ fontSize: 12, color: "var(--muted-foreground)" }} aria-hidden="true" />
                        </button>
                        {isOpen && (
                          <div style={{ padding: "2px 8px 8px 26px" }}>
                            {f.options.length > 8 && <input value={fieldQ} onChange={(e) => setFieldQ(e.target.value)} placeholder="Search…" style={{ width: "100%", boxSizing: "border-box", fontSize: 11.5, padding: "4px 8px", borderRadius: 6, border: "0.5px solid var(--border)", marginBottom: 4 }} />}
                            <div style={{ maxHeight: 170, overflowY: "auto" }}>
                              {opts.length === 0 && <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", padding: "3px 0" }}>{f.options.length === 0 ? "No options." : "No matches."}</div>}
                              {opts.map((o) => (
                                <label key={o} style={{ display: "flex", alignItems: "center", gap: 7, padding: "3px 0", fontSize: 12, cursor: "pointer" }}>
                                  <input type="checkbox" checked={(state.fields[f.key] ?? []).includes(o)} onChange={() => toggleValue(f.key, o)} style={{ width: 13, height: 13 }} />
                                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div style={{ borderRight: "0.5px solid #eef1f5" }}>
                  <div style={{ padding: "9px 12px", fontSize: 11, fontWeight: 600, color: "#633806" }}><i className="ti ti-layout-list" aria-hidden="true" /> GROUP BY</div>
                  {groups.map((g) => {
                    const on = (state.groupBy || noGroupId) === g.id;
                    return <button type="button" key={g.id} onClick={() => set({ groupBy: g.id })} style={{ ...item, background: on ? "#FBF3E6" : "none", color: on ? "#633806" : "var(--foreground)" }}>{on ? "✓ " : ""}{g.label}</button>;
                  })}
                </div>
                <div>
                  <div style={{ padding: "9px 12px", fontSize: 11, fontWeight: 600, color: "#7A5AA8" }}><i className="ti ti-star" aria-hidden="true" /> FAVORITES</div>
                  {mine.length === 0 && <div style={{ padding: "4px 12px 4px 26px", fontSize: 11.5, color: "var(--muted-foreground)" }}>None yet — save one below.</div>}
                  {mine.map(favRow)}
                  {!personalOnly && (
                    <>
                      <div style={{ borderTop: "0.5px solid #eef1f5", margin: "5px 0 0" }} />
                      <div style={{ padding: "8px 12px 3px", fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)" }}><i className="ti ti-users" aria-hidden="true" /> SHARED FILTERS</div>
                      {shared.length === 0 && <div style={{ padding: "2px 12px 6px 26px", fontSize: 11.5, color: "var(--muted-foreground)" }}>Nothing shared by the team yet.</div>}
                      {shared.map(favRow)}
                    </>
                  )}
                  <div style={{ borderTop: "0.5px solid #eef1f5", margin: "5px 0 0" }} />
                  <button type="button" onClick={() => setSaveOpen((v) => !v)} style={{ ...item, display: "flex", alignItems: "center", paddingLeft: 12, fontWeight: 500 }}>
                    <span style={{ flex: 1 }}>Save current search</span>
                    <i className={`ti ti-chevron-${saveOpen ? "up" : "down"}`} style={{ fontSize: 12, color: "var(--muted-foreground)" }} aria-hidden="true" />
                  </button>
                  {saveOpen && (
                    <div style={{ margin: "2px 12px 8px", background: "var(--muted)", borderRadius: 8, padding: "8px 10px" }}>
                      <input value={saveName} onChange={(e) => setSaveName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void saveCurrent(); }} autoFocus placeholder="Name this search" style={{ width: "100%", boxSizing: "border-box", fontSize: 12, padding: "6px 8px", borderRadius: 7, border: "0.5px solid var(--border)", background: "#fff", marginBottom: 7 }} />
                      <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, marginBottom: 4, cursor: "pointer" }}><input type="checkbox" checked={saveDefault} onChange={(e) => setSaveDefault(e.target.checked)} style={{ width: 13, height: 13 }} /> Default filter</label>
                      {!personalOnly && (
                        <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, marginBottom: 8, cursor: "pointer" }}><input type="checkbox" checked={saveShared} onChange={(e) => setSaveShared(e.target.checked)} style={{ width: 13, height: 13 }} /> Shared with team</label>
                      )}
                      <button type="button" onClick={() => void saveCurrent()} disabled={!saveName.trim()} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#7A5AA8", border: "none", borderRadius: 7, padding: "6px 14px", cursor: "pointer", opacity: saveName.trim() ? 1 : 0.5 }}>Save</button>
                    </div>
                  )}
                  {hasAny && <button type="button" onClick={clearAll} style={{ ...item, color: "#A32D2D", paddingLeft: 12 }}>Clear all filters</button>}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** Case-insensitive "any of these strings contains q". */
export function textMatch(q: string, ...hay: Array<string | null | undefined>): boolean {
  const n = q.trim().toLowerCase();
  if (!n) return true;
  return hay.some((h) => (h ?? "").toLowerCase().includes(n));
}
