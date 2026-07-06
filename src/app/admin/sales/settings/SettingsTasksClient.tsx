"use client";

import { useCallback, useEffect, useState } from "react";

type Staff = { id: string; name: string };

export function SettingsTasksClient({ staff }: { staff: Staff[] }) {
  const [taskTypes, setTaskTypes] = useState<string[] | null>(null);
  const [assignee, setAssignee] = useState<string>("");
  const [newType, setNewType] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/sales/settings");
    if (res.ok) { const s = (await res.json()).settings; setTaskTypes(s.taskTypes); setAssignee(s.defaultAssigneeId ?? ""); }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- load on mount
  useEffect(() => { void load(); }, [load]);

  async function save(next: { taskTypes?: string[]; defaultAssigneeId?: string | null }) {
    setSaving(true); setMsg(null);
    try {
      const res = await fetch("/api/sales/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed.");
      setMsg("Saved.");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Save failed."); } finally { setSaving(false); }
  }

  if (!taskTypes) return <p style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>Loading…</p>;

  function addType() {
    const t = newType.trim();
    if (!t || taskTypes!.includes(t)) { setNewType(""); return; }
    const next = [...taskTypes!, t];
    setTaskTypes(next); setNewType(""); void save({ taskTypes: next });
  }
  function removeType(t: string) {
    const next = taskTypes!.filter((x) => x !== t);
    setTaskTypes(next); void save({ taskTypes: next });
  }

  return (
    <div style={{ flex: 1, background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, padding: 16, maxWidth: 460 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>Task &amp; activity types</div>
      <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 12 }}>Used when creating tasks across the Sales Hub.</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {taskTypes.map((t) => (
          <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "#185FA5", background: "#E6F1FB", border: "0.5px solid #B5D4F4", borderRadius: 14, padding: "3px 9px" }}>
            {t}
            <button onClick={() => removeType(t)} style={{ background: "none", border: "none", cursor: "pointer", color: "#185FA5", fontSize: 12, lineHeight: 1 }}>×</button>
          </span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
        <input value={newType} onChange={(e) => setNewType(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addType()} placeholder="Add task type…" style={{ flex: 1, fontSize: 12, padding: "6px 9px", borderRadius: 7, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }} />
        <button onClick={addType} style={{ fontSize: 12, fontWeight: 600, color: "#185FA5", background: "#E6F1FB", border: "0.5px solid #B5D4F4", borderRadius: 7, padding: "6px 12px", cursor: "pointer" }}>Add</button>
      </div>

      <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>Default assignee</div>
      <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 8 }}>New tasks default to this person unless you pick another.</div>
      <select value={assignee} onChange={(e) => { setAssignee(e.target.value); void save({ defaultAssigneeId: e.target.value || null }); }} style={{ width: "100%", fontSize: 12, padding: "7px 9px", borderRadius: 7, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}>
        <option value="">Task creator</option>
        {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>

      {msg && <div style={{ fontSize: 11.5, color: msg === "Saved." ? "#0F6E56" : "#A32D2D", marginTop: 12 }}>{saving ? "Saving…" : msg}</div>}
    </div>
  );
}
