"use client";

/**
 * The Contacts search bar (Odoo style): condition chips + field type-ahead + a
 * Filters / Group by / Favorites dropdown. Presentational: all state lives in the
 * parent, which owns the FilterSpec. Used by Sales Contacts and the IR matching
 * queue's "Search all investors" tab.
 */
import { useState } from "react";
import { GROUP_BY_OPTIONS } from "@/lib/sales/contact-grouping";
import { FIELD_REGISTRY, OP_LABEL, fieldDef, type FilterSpec, type Condition, type Operator } from "@/lib/sales/contact-filter-spec";

export type SavedSearch = { id: string; name: string; spec: FilterSpec; groupBy: string | null; columns: string[] | null; isDefault: boolean; isShared: boolean; mine: boolean; ownerName?: string; canDelete?: boolean };

// Odoo-style unified search bar: facet pills + field type-ahead + a three-panel
// (Filters / Group By / Favorites) dropdown. Presentational — all state lives in the
// parent; this renders it and calls back.
export type ContactsSearchBarProps = {
  spec: FilterSpec; typed: string; setTyped: (v: string) => void; searchOpen: boolean; setSearchOpen: (v: boolean) => void;
  addCondition: (c: Condition) => void; removeConditionAt: (i: number) => void; condLabel: (c: Condition) => string;
  toggleQuick: (c: Condition) => void; quickActive: (c: Condition) => boolean; firstOfMonth: () => string;
  groupBy: string; setGroupBy: (v: string) => void; groupByLabel: string;
  saved: SavedSearch[]; applySaved: (s: SavedSearch) => void; deleteSaved: (id: string) => void;
  openCustom: () => void; clearAll: () => void;
  facetOpts: Record<string, string[]>; toggleFacetValue: (field: string, v: string) => void; facetValueActive: (field: string, v: string) => boolean;
  save: { open: boolean; setOpen: (v: boolean) => void; name: string; setName: (v: string) => void; isDefault: boolean; setDefault: (v: boolean) => void; shared: boolean; setShared: (v: boolean) => void; submit: () => void };
  /** Hide the Investors / Founders / Advisors rows (a list already locked to one type). */
  hideTypeQuick?: boolean;
  /** Group by options to show instead of the Contacts list. */
  groupOptions?: { id: string; label: string }[];
  /** The group id that means "no grouping" (no chip). Contacts uses "profile". */
  noGroupId?: string;
  placeholder?: string;
};
export function ContactsSearchBar(p: ContactsSearchBarProps) {
  const TEXT_FIELDS = [{ f: "name", l: "Name" }, { f: "company", l: "Company" }, { f: "email", l: "Email" }, { f: "phone", l: "Phone" }];
  // Odoo layout: Type first, then quick filters, then the questionnaire facets as
  // expandable rows with checkboxes, then Add custom filter.
  const TYPE_QUICK: { label: string; cond: Condition }[] = [
    { label: "Investors", cond: { field: "type", op: "in", value: ["investor"] } },
    { label: "Founders", cond: { field: "type", op: "in", value: ["founder"] } },
    { label: "Advisors", cond: { field: "type", op: "in", value: ["advisor"] } },
  ];
  const QUICK: { label: string; cond: Condition }[] = [
    { label: "Has email", cond: { field: "email", op: "set" } },
    { label: "Has phone", cond: { field: "phone", op: "set" } },
    { label: "Unassigned", cond: { field: "assignee", op: "not_set" } },
    { label: "Added this month", cond: { field: "createdAt", op: "after", value: p.firstOfMonth() } },
    { label: "Not in sales pipeline", cond: { field: "salesOpp", op: "not_set" } },
    { label: "In sales pipeline", cond: { field: "salesOpp", op: "set" } },
  ];
  const FACET_ROWS: { field: string; label: string; source: string }[] = [
    { field: "investorTypes", label: "Investor profile", source: "investorTypes" },
    { field: "industries", label: "Industry", source: "industries" },
    { field: "leadSource", label: "Lead source", source: "leadSource" },
    { field: "operatingStages", label: "Operating stage", source: "operatingStages" },
    { field: "fundingStages", label: "Funding stage", source: "fundingStages" },
    { field: "capital", label: "Amount / type of capital", source: "capital" },
  ];
  const [openFacet, setOpenFacet] = useState<string | null>(null);
  const [facetQ, setFacetQ] = useState("");
  const noGroup = p.noGroupId ?? "profile";
  const groupOpts = p.groupOptions ?? GROUP_BY_OPTIONS.filter((o) => o.id === "profile" || o.section !== "profile").map((o) => ({ id: o.id, label: o.id === "profile" ? "Type" : o.label }));
  const item = { display: "block", width: "100%", textAlign: "left" as const, padding: "6px 12px 6px 26px", fontSize: 12.5, background: "none", border: "none", cursor: "pointer", color: "var(--foreground)" };
  const mine = p.saved.filter((s) => s.mine);
  const shared = p.saved.filter((s) => !s.mine && s.isShared);
  const activeFacetCount = (field: string) => { const c = p.spec.conditions.find((c) => c.field === field && c.op === "in"); return Array.isArray(c?.value) ? c!.value.length : 0; };
  const favRow = (s: SavedSearch) => (
    <div key={s.id} style={{ display: "flex", alignItems: "center" }}>
      <button type="button" onClick={() => p.applySaved(s)} style={{ ...item, flex: 1, paddingRight: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        <i className="ti ti-star" style={{ color: "#7A5AA8", marginRight: 4 }} aria-hidden="true" />{s.name}
        {s.mine && s.isDefault ? <span style={{ color: "var(--muted-foreground)", fontSize: 11 }}> · default</span> : null}
        {!s.mine ? <span style={{ color: "var(--muted-foreground)", fontSize: 11 }}> · {s.ownerName ?? "Staff"}</span> : s.isShared ? <span style={{ color: "var(--muted-foreground)", fontSize: 11 }}> · shared</span> : null}
      </button>
      {(s.canDelete ?? s.mine) && <button type="button" onClick={() => { if (window.confirm(`Delete saved search “${s.name}”?`)) p.deleteSaved(s.id); }} aria-label={`Delete ${s.name}`} title="Delete" style={{ border: "none", background: "none", color: "#A32D2D", cursor: "pointer", padding: "0 10px" }}><i className="ti ti-trash" style={{ fontSize: 13 }} aria-hidden="true" /></button>}
    </div>
  );

  return (
    <div style={{ position: "relative", flex: "1 1 360px", minWidth: 280, maxWidth: 640 }}>
      <div style={{ position: "relative", zIndex: 26, display: "flex", alignItems: "center", gap: 5, border: "1px solid #cdd9ec", borderRadius: 9, padding: "5px 8px", background: "#fff", flexWrap: "wrap" }}>
        {p.spec.conditions.map((c, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", border: "0.5px solid #B5D4F4", background: "#E6F1FB", borderRadius: 6, overflow: "hidden", fontSize: 11.5 }}>
            <span style={{ padding: "3px 8px", color: "#0C447C" }}>{p.condLabel(c)}</span>
            <button type="button" onClick={() => p.removeConditionAt(i)} style={{ border: "none", background: "#B5D4F4", color: "#0C447C", padding: "3px 6px", cursor: "pointer" }}>×</button>
          </span>
        ))}
        {p.groupBy !== noGroup && (
          <span style={{ display: "inline-flex", alignItems: "center", border: "0.5px solid #E3C08A", background: "#FAEEDA", borderRadius: 6, overflow: "hidden", fontSize: 11.5 }}>
            <span style={{ padding: "3px 8px", color: "#633806" }}>▤ {p.groupByLabel}</span>
            <button type="button" onClick={() => p.setGroupBy(noGroup)} style={{ border: "none", background: "#E3C08A", color: "#633806", padding: "3px 6px", cursor: "pointer" }}>×</button>
          </span>
        )}
        <input
          value={p.typed}
          onChange={(e) => { p.setTyped(e.target.value); p.setSearchOpen(true); }}
          onFocus={() => p.setSearchOpen(true)}
          onKeyDown={(e) => { if (e.key === "Enter" && p.typed.trim()) p.addCondition({ field: "name", op: "contains", value: p.typed.trim() }); }}
          placeholder={p.spec.conditions.length ? "" : p.placeholder ?? "Search…"}
          style={{ flex: 1, minWidth: 90, border: "none", outline: "none", fontSize: 13, padding: "4px 2px", background: "transparent" }}
        />
        <button type="button" onClick={() => p.setSearchOpen(!p.searchOpen)} style={{ border: "none", background: "none", color: "#2E78F5", cursor: "pointer", fontSize: 14 }}><i className="ti ti-chevron-down" aria-hidden="true" /></button>
      </div>

      {p.searchOpen && (
        <>
          <div onClick={() => p.setSearchOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 25 }} />
          <div style={{ position: "absolute", top: "calc(100% + 5px)", right: 0, width: p.typed.trim() ? "100%" : 640, maxWidth: "calc(100vw - 48px)", zIndex: 30, background: "#fff", border: "0.5px solid #cbd5e1", borderRadius: 10, boxShadow: "0 14px 30px rgba(0,0,0,.14)", overflow: "hidden" }}>
            {p.typed.trim() ? (
              <div style={{ padding: "4px 0" }}>
                {TEXT_FIELDS.map(({ f, l }) => (
                  <button type="button" key={f} onClick={() => p.addCondition({ field: f, op: "contains", value: p.typed.trim() })} style={{ ...item, paddingLeft: 12 }}>
                    Search <b>{l}</b> for: <span style={{ color: "#185FA5" }}>{p.typed.trim()}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.15fr", alignItems: "start" }}>
                <div style={{ borderRight: "0.5px solid #eef1f5" }}>
                  <div style={{ padding: "9px 12px", fontSize: 11, fontWeight: 600, color: "#185FA5" }}><i className="ti ti-filter" aria-hidden="true" /> FILTERS</div>
                  {!p.hideTypeQuick && <>
                  {TYPE_QUICK.map((qf) => {
                    const on = p.quickActive(qf.cond);
                    return <button type="button" key={qf.label} onClick={() => p.toggleQuick(qf.cond)} style={{ ...item, background: on ? "#EEF4FF" : "none", color: on ? "#185FA5" : "var(--foreground)" }}>{on ? "✓ " : ""}{qf.label}</button>;
                  })}
                  <div style={{ borderTop: "0.5px solid #eef1f5", margin: "5px 0" }} />
                  </>}
                  {QUICK.map((qf) => {
                    const on = p.quickActive(qf.cond);
                    return <button type="button" key={qf.label} onClick={() => p.toggleQuick(qf.cond)} style={{ ...item, background: on ? "#EEF4FF" : "none", color: on ? "#185FA5" : "var(--foreground)" }}>{on ? "✓ " : ""}{qf.label}</button>;
                  })}
                  <div style={{ borderTop: "0.5px solid #eef1f5", margin: "5px 0" }} />
                  {FACET_ROWS.map((f) => {
                    const isOpen = openFacet === f.field;
                    const n = activeFacetCount(f.field);
                    const all = p.facetOpts[f.source] ?? [];
                    const opts = all.filter((o) => o.toLowerCase().includes(facetQ.toLowerCase()));
                    return (
                      <div key={f.field}>
                        <button type="button" onClick={() => { setOpenFacet(isOpen ? null : f.field); setFacetQ(""); }} style={{ ...item, display: "flex", alignItems: "center", gap: 6, color: n ? "#185FA5" : "var(--foreground)" }}>
                          <span style={{ flex: 1 }}>{f.label}</span>
                          {n > 0 && <span style={{ fontSize: 10.5, color: "#185FA5", background: "#E6F1FB", borderRadius: 10, padding: "0 7px" }}>{n}</span>}
                          <i className={`ti ti-chevron-${isOpen ? "down" : "right"}`} style={{ fontSize: 12, color: "var(--muted-foreground)" }} aria-hidden="true" />
                        </button>
                        {isOpen && (
                          <div style={{ padding: "2px 8px 8px 26px" }}>
                            {all.length > 8 && <input value={facetQ} onChange={(e) => setFacetQ(e.target.value)} placeholder="Search…" style={{ width: "100%", boxSizing: "border-box", fontSize: 11.5, padding: "4px 8px", borderRadius: 6, border: "0.5px solid var(--border)", marginBottom: 4 }} />}
                            <div style={{ maxHeight: 170, overflowY: "auto" }}>
                              {opts.length === 0 && <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", padding: "3px 0" }}>{all.length === 0 ? "No options loaded yet." : "No matches."}</div>}
                              {opts.map((o) => (
                                <label key={o} style={{ display: "flex", alignItems: "center", gap: 7, padding: "3px 0", fontSize: 12, cursor: "pointer" }}>
                                  <input type="checkbox" checked={p.facetValueActive(f.field, o)} onChange={() => p.toggleFacetValue(f.field, o)} style={{ width: 13, height: 13 }} />
                                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div style={{ borderTop: "0.5px solid #eef1f5", margin: "5px 0 0" }} />
                  <button type="button" onClick={p.openCustom} style={{ ...item, color: "#2E78F5", fontWeight: 500, paddingLeft: 12 }}>＋ Add custom filter</button>
                </div>
                <div style={{ borderRight: "0.5px solid #eef1f5" }}>
                  <div style={{ padding: "9px 12px", fontSize: 11, fontWeight: 600, color: "#633806" }}><i className="ti ti-layout-list" aria-hidden="true" /> GROUP BY</div>
                  {groupOpts.map((o) => {
                    const on = p.groupBy === o.id;
                    return <button type="button" key={o.id} onClick={() => { p.setGroupBy(o.id); }} style={{ ...item, background: on ? "#FBF3E6" : "none", color: on ? "#633806" : "var(--foreground)" }}>{on ? "✓ " : ""}{o.label}</button>;
                  })}
                </div>
                <div>
                  <div style={{ padding: "9px 12px", fontSize: 11, fontWeight: 600, color: "#7A5AA8" }}><i className="ti ti-star" aria-hidden="true" /> FAVORITES</div>
                  {mine.length === 0 && <div style={{ padding: "4px 12px 4px 26px", fontSize: 11.5, color: "var(--muted-foreground)" }}>None yet — save one below.</div>}
                  {mine.map(favRow)}
                  <div style={{ borderTop: "0.5px solid #eef1f5", margin: "5px 0 0" }} />
                  <div style={{ padding: "8px 12px 3px", fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)" }}><i className="ti ti-users" aria-hidden="true" /> SHARED FILTERS</div>
                  {shared.length === 0 && <div style={{ padding: "2px 12px 6px 26px", fontSize: 11.5, color: "var(--muted-foreground)" }}>Nothing shared by the team yet.</div>}
                  {shared.map(favRow)}
                  <div style={{ borderTop: "0.5px solid #eef1f5", margin: "5px 0 0" }} />
                  <button type="button" onClick={() => p.save.setOpen(!p.save.open)} style={{ ...item, display: "flex", alignItems: "center", paddingLeft: 12, color: "var(--foreground)", fontWeight: 500 }}>
                    <span style={{ flex: 1 }}>Save current search</span>
                    <i className={`ti ti-chevron-${p.save.open ? "up" : "down"}`} style={{ fontSize: 12, color: "var(--muted-foreground)" }} aria-hidden="true" />
                  </button>
                  {p.save.open && (
                    <div style={{ margin: "2px 12px 8px", background: "var(--muted)", borderRadius: 8, padding: "8px 10px" }}>
                      <input value={p.save.name} onChange={(e) => p.save.setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") p.save.submit(); }} autoFocus placeholder="Name this search" style={{ width: "100%", boxSizing: "border-box", fontSize: 12, padding: "6px 8px", borderRadius: 7, border: "0.5px solid var(--border)", background: "#fff", marginBottom: 7 }} />
                      <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, marginBottom: 4, cursor: "pointer" }}><input type="checkbox" checked={p.save.isDefault} onChange={(e) => p.save.setDefault(e.target.checked)} style={{ width: 13, height: 13 }} /> Default filter</label>
                      <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, marginBottom: 8, cursor: "pointer" }}><input type="checkbox" checked={p.save.shared} onChange={(e) => p.save.setShared(e.target.checked)} style={{ width: 13, height: 13 }} /> Shared with team</label>
                      <button type="button" onClick={p.save.submit} disabled={!p.save.name.trim()} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#7A5AA8", border: "none", borderRadius: 7, padding: "6px 14px", cursor: "pointer", opacity: p.save.name.trim() ? 1 : 0.5 }}>Save</button>
                    </div>
                  )}
                  {p.spec.conditions.length > 0 && <button type="button" onClick={() => { p.clearAll(); }} style={{ ...item, color: "#A32D2D", paddingLeft: 12 }}>Clear all filters</button>}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * "Add custom filter" builder: pick field, operator and value(s), then Apply. Owns its
 * draft; the parent gets the finished spec. `excludeFields` hides fields the list already
 * fixes (e.g. Type on an investors-only list); `matchAllOnly` hides the any/all switch
 * when the parent adds a locked condition that must always hold.
 */
export function CustomFilterDialog({ spec, onApply, onClose, optionsFor, excludeFields = [], matchAllOnly = false }: {
  spec: FilterSpec; onApply: (s: FilterSpec) => void; onClose: () => void;
  optionsFor: (source: string | undefined) => { value: string; label: string }[];
  excludeFields?: string[]; matchAllOnly?: boolean;
}) {
  const fields = FIELD_REGISTRY.filter((f) => !excludeFields.includes(f.key));
  const [draft, setDraft] = useState<FilterSpec>(() => ({ match: matchAllOnly ? "all" : spec.match, conditions: spec.conditions.length ? spec.conditions : [{ field: "name", op: "contains", value: "" }] }));
  const inp = { fontSize: 12.5, padding: "6px 8px", borderRadius: 7, border: "0.5px solid #cdd9ec", background: "#fff" } as const;
  const at = (i: number, patch: Partial<Condition>) => setDraft((d) => ({ ...d, conditions: d.conditions.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));
  const setField = (i: number, field: string) => { const op = (fieldDef(field)?.ops[0] ?? "contains") as Operator; at(i, { field, op, value: op === "in" ? [] : "" }); };
  const setOp = (i: number, op: Operator) => at(i, { op, value: op === "in" ? [] : op === "set" || op === "not_set" ? undefined : "" });
  const toggle = (i: number, v: string) => setDraft((d) => ({ ...d, conditions: d.conditions.map((c, j) => { if (j !== i) return c; const cur = Array.isArray(c.value) ? c.value : []; return { ...c, value: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] }; }) }));
  const apply = () => onApply({ match: matchAllOnly ? "all" : draft.match, conditions: draft.conditions.filter((c) => fieldDef(c.field) && !excludeFields.includes(c.field)) });
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div role="dialog" aria-label="Add custom filter" onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 16, width: 620, maxWidth: "100%", maxHeight: "88vh", overflow: "auto", boxShadow: "0 20px 48px rgba(0,0,0,.2)" }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Add custom filter</div>
        {!matchAllOnly && (
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 12 }}>
            Match{" "}
            <select value={draft.match} onChange={(e) => setDraft((d) => ({ ...d, match: e.target.value as "all" | "any" }))} style={{ ...inp, padding: "3px 7px" }}>
              <option value="all">all</option><option value="any">any</option>
            </select>{" "}of the following:
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {draft.conditions.map((c, i) => {
            const def = fieldDef(c.field);
            const needsValue = c.op !== "set" && c.op !== "not_set";
            const opts = optionsFor(def?.options);
            return (
              <div key={i} style={{ border: "0.5px solid #e2e6ed", borderRadius: 9, padding: 10 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <select value={c.field} onChange={(e) => setField(i, e.target.value)} style={{ ...inp, flex: 1.2 }}>
                    {fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </select>
                  <select value={c.op} onChange={(e) => setOp(i, e.target.value as Operator)} style={{ ...inp, flex: 1 }}>
                    {(def?.ops ?? []).map((o) => <option key={o} value={o}>{OP_LABEL[o]}</option>)}
                  </select>
                  <button type="button" onClick={() => setDraft((d) => ({ ...d, conditions: d.conditions.filter((_, j) => j !== i) }))} aria-label="Remove condition" style={{ border: "0.5px solid #F0C0C0", color: "#A32D2D", background: "#fff", borderRadius: 7, padding: "6px 9px", cursor: "pointer" }}>×</button>
                </div>
                {needsValue && (
                  <div style={{ marginTop: 8 }}>
                    {c.op === "in" ? (
                      <div style={{ maxHeight: 132, overflowY: "auto", border: "0.5px solid #e2e6ed", borderRadius: 7, padding: 6 }}>
                        {opts.length === 0 && <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", padding: 4 }}>No options.</div>}
                        {opts.map((o) => (
                          <label key={o.value} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 4px", fontSize: 12, cursor: "pointer" }}>
                            <input type="checkbox" checked={Array.isArray(c.value) && c.value.includes(o.value)} onChange={() => toggle(i, o.value)} style={{ width: 13, height: 13 }} />
                            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.label}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <input type={def?.kind === "date" ? "date" : "text"} value={typeof c.value === "string" ? c.value : ""} onChange={(e) => at(i, { value: e.target.value })} placeholder="Value…" style={{ ...inp, width: "100%", boxSizing: "border-box" }} />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <button type="button" onClick={() => setDraft((d) => ({ ...d, conditions: [...d.conditions, { field: "name", op: "contains" as Operator, value: "" }] }))} style={{ marginTop: 10, fontSize: 12, color: "#2E78F5", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>＋ New condition</button>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
          <button type="button" onClick={onClose} style={{ fontSize: 12, color: "var(--muted-foreground)", background: "transparent", border: "0.5px solid #cdd9ec", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>Cancel</button>
          <button type="button" onClick={apply} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer" }}>Apply</button>
        </div>
      </div>
    </div>
  );
}
