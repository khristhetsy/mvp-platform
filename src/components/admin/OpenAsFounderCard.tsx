"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { buildFounderCards } from "@/lib/feature-controls/by-stage";
import { ACTING_ACCOUNT_ITEMS } from "@/lib/departments/founder-access-core";

type Dept = { id: string; name: string; isAdmin: boolean };
type Data = { departments: Dept[]; grants: Record<string, boolean> };
type Item = { key: string; label: string; note: string; always: boolean };
type Group = { title: string; items: Item[] };

const navy = "#0A1A40", royal = "#1A6CE4";

/** The founder menu, one group per stage, built from the real menu so a new item appears here by itself. */
function buildGroups(): Group[] {
  const groups: Group[] = [];
  const seen = new Set<string>();
  for (const card of buildFounderCards()) {
    const items: Item[] = [];
    for (const r of card.rows) {
      if (!r.href || seen.has(r.href)) continue;
      seen.add(r.href);
      items.push({ key: r.href, label: r.label, note: r.href, always: r.kind === "always" });
    }
    if (items.length) groups.push({ title: card.title, items });
  }
  groups.push({ title: "Account, legal and security", items: ACTING_ACCOUNT_ITEMS.map((a) => ({ key: a.key, label: a.label, note: a.note, always: false })) });
  return groups;
}

function Toggle({ on, label, onChange }: { on: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} style={{ width: 34, height: 19, borderRadius: 10, border: "none", background: on ? "#12A150" : "#D3D9E6", position: "relative", cursor: "pointer", padding: 0 }}>
      <span style={{ position: "absolute", top: 2, left: on ? 17 : 2, width: 15, height: 15, borderRadius: "50%", background: "#fff", transition: "left .15s" }} />
    </button>
  );
}

/**
 * Feature Controls, Departments: what each department can do while staff open a founder account
 * with Open as founder. A switch that is on overrides the founder's own switches, locks, quotas and
 * guards. No saved switch means on, so new menu items open by default.
 */
export function OpenAsFounderCard() {
  const groups = useMemo(() => buildGroups(), []);
  const [data, setData] = useState<Data | null>(null);
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/departments/founder-access");
    if (res.ok) { const d: Data = await res.json(); setData(d); setDraft({ ...d.grants }); }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- load switches on mount
  useEffect(() => { void load(); }, [load]);

  const isOn = (map: Record<string, boolean>, deptId: string, key: string) => map[`${deptId}|${key}`] ?? true;

  const changes = useMemo(() => {
    if (!data) return [] as Array<{ departmentId: string; itemKey: string; enabled: boolean }>;
    const out: Array<{ departmentId: string; itemKey: string; enabled: boolean }> = [];
    for (const d of data.departments) {
      for (const g of groups) for (const it of g.items) {
        if (it.always) continue;
        const now = isOn(draft, d.id, it.key), was = isOn(data.grants, d.id, it.key);
        if (now !== was) out.push({ departmentId: d.id, itemKey: it.key, enabled: now });
      }
    }
    return out;
  }, [data, draft, groups]);

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/departments/founder-access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ changes }) });
      if (res.ok) { await load(); setMsg("Saved."); } else { setMsg("Save failed."); }
    } finally { setBusy(false); }
  }

  if (!data) return <p style={{ fontSize: 13, color: "#6B7690", marginTop: 16 }}>Loading…</p>;
  const grid = `1.7fr repeat(${data.departments.length}, 1fr)`;

  return (
    <div style={{ border: "1px solid #E4E8F0", borderRadius: 12, overflow: "hidden", background: "#fff", marginTop: 16 }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid #E4E8F0", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: navy }}>Open as founder access</div>
          <div style={{ fontSize: 11.5, color: "#6B7690", marginTop: 3, maxWidth: 640 }}>
            What each department can do when a staff member uses Open as on a founder account. A switch that is on overrides the founder&apos;s own switches, stage and plan locks, quotas and guards. New menu items start on.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "none" }}>
          {msg && <span style={{ fontSize: 11.5, color: "#6B7690" }}>{msg}</span>}
          {changes.length > 0 && <span style={{ fontSize: 11.5, color: "#B45309" }}>{changes.length} unsaved</span>}
          <button type="button" onClick={save} disabled={busy || changes.length === 0} style={{ fontSize: 12.5, fontWeight: 600, color: "#fff", background: royal, border: "none", borderRadius: 8, padding: "7px 14px", cursor: busy || changes.length === 0 ? "default" : "pointer", opacity: busy || changes.length === 0 ? 0.5 : 1 }}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: grid, background: "#F6F8FB", borderBottom: "1px solid #E4E8F0" }}>
        <div style={{ padding: "10px 14px", fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", color: "#6B7690" }}>Feature</div>
        {data.departments.map((d) => <div key={d.id} style={{ padding: "10px 8px", textAlign: "center", fontSize: 12, fontWeight: 700, color: navy }}>{d.name}</div>)}
      </div>

      {groups.map((g) => (
        <div key={g.title}>
          <div style={{ padding: "7px 14px", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: royal, background: "#EEF3FC", borderBottom: "1px solid #E4E8F0", borderTop: "1px solid #E4E8F0" }}>{g.title}</div>
          {g.items.map((it) => (
            <div key={it.key} style={{ display: "grid", gridTemplateColumns: grid, borderBottom: "1px solid #F1F4F9", alignItems: "center" }}>
              <div style={{ padding: "9px 14px", fontSize: 12.5 }}>
                {it.label} {it.note ? <code style={{ fontSize: 10.5, color: "#94a3b8" }}>{it.note}</code> : null}
              </div>
              {it.always ? (
                <div style={{ gridColumn: "2 / -1", textAlign: "center" }}><span style={{ fontSize: 10.5, color: "#475569", background: "#F1F5F9", borderRadius: 6, padding: "2px 10px" }}>Always on</span></div>
              ) : data.departments.map((d) => (
                <div key={d.id} style={{ textAlign: "center" }}>
                  <Toggle on={isOn(draft, d.id, it.key)} label={`${it.label}, ${d.name}`} onChange={(v) => setDraft((p) => ({ ...p, [`${d.id}|${it.key}`]: v }))} />
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}

      <div style={{ padding: "11px 16px", fontSize: 11.5, color: "#475569", background: "#F8FAFC", borderTop: "1px solid #E4E8F0" }}>
        Whether a staff member may open a founder at all is still decided by the act_on_behalf permission or Managed by iCFO. Every action taken while acting is recorded with the staff member&apos;s ID.
      </div>
    </div>
  );
}
