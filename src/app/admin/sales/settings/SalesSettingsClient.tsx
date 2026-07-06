"use client";

import { useCallback, useEffect, useState } from "react";

type Settings = { taskTypes: string[]; remindTaskDue: boolean; remindStalled: boolean; stalledDays: number };

function ToggleSwitch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label="toggle" style={{ width: 36, height: 20, borderRadius: 10, border: "none", background: on ? "#2E78F5" : "var(--muted)", position: "relative", cursor: "pointer" }}>
      <span style={{ position: "absolute", top: 2, left: on ? 18 : 2, width: 16, height: 16, background: "#fff", borderRadius: "50%", transition: "left .12s" }} />
    </button>
  );
}

export function SalesSettingsClient() {
  const [s, setS] = useState<Settings | null>(null);
  const [newType, setNewType] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/sales/settings");
    if (res.ok) setS((await res.json()).settings);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- load settings on mount
  useEffect(() => { void load(); }, [load]);

  async function save() {
    if (!s) return;
    setSaving(true); setMsg(null);
    try {
      const res = await fetch("/api/sales/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Save failed."); }
      setMsg("Saved.");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Save failed."); } finally { setSaving(false); }
  }

  if (!s) return <p style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>Loading…</p>;

  function addType() {
    const t = newType.trim();
    if (!t || !s || s.taskTypes.includes(t)) { setNewType(""); return; }
    setS({ ...s, taskTypes: [...s.taskTypes, t] }); setNewType("");
  }
  function toggle(field: "remindTaskDue" | "remindStalled") { if (s) setS({ ...s, [field]: !s[field] }); }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      {/* A. Tasks */}
      <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>Task types</div>
        <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 12 }}>Used when creating &amp; assigning sales tasks (shared task engine).</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {s.taskTypes.map((t) => (
            <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "#185FA5", background: "#E6F1FB", border: "0.5px solid #B5D4F4", borderRadius: 14, padding: "3px 9px" }}>
              {t}
              <button onClick={() => setS({ ...s, taskTypes: s.taskTypes.filter((x) => x !== t) })} style={{ background: "none", border: "none", cursor: "pointer", color: "#185FA5", fontSize: 12, lineHeight: 1 }}>×</button>
            </span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <input value={newType} onChange={(e) => setNewType(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addType()} placeholder="Add task type…" style={{ flex: 1, fontSize: 12, padding: "6px 9px", borderRadius: 7, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }} />
          <button onClick={addType} style={{ fontSize: 12, fontWeight: 600, color: "#185FA5", background: "#E6F1FB", border: "0.5px solid #B5D4F4", borderRadius: 7, padding: "6px 12px", cursor: "pointer" }}>Add</button>
        </div>
      </div>

      {/* B. Notifications */}
      <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 12 }}>Reminder notifications</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ flex: 1, fontSize: 12, color: "var(--muted-foreground)" }}>Remind assignee when a task is due</span>
            <ToggleSwitch on={s.remindTaskDue} onClick={() => toggle("remindTaskDue")} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ flex: 1, fontSize: 12, color: "var(--muted-foreground)" }}>Notify on stalled opportunities</span>
            <ToggleSwitch on={s.remindStalled} onClick={() => toggle("remindStalled")} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ flex: 1, fontSize: 12, color: "var(--muted-foreground)" }}>Opportunity is stalled after</span>
            <input type="number" min={1} max={90} value={s.stalledDays} onChange={(e) => setS({ ...s, stalledDays: Number(e.target.value) })} style={{ width: 56, textAlign: "center", fontSize: 12, padding: "5px 8px", borderRadius: 7, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }} />
            <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>days</span>
          </div>
          <div style={{ fontSize: 10.5, color: "var(--muted-foreground)" }}>Reminders send in-app to the owner (email activates once the transactional sender is on a verified domain).</div>
        </div>
      </div>

      <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={save} disabled={saving} style={{ fontSize: 12.5, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 8, padding: "9px 18px", cursor: "pointer", opacity: saving ? 0.5 : 1 }}>{saving ? "Saving…" : "Save settings"}</button>
        {msg && <span style={{ fontSize: 11.5, color: msg === "Saved." ? "#0F6E56" : "#A32D2D" }}>{msg}</span>}
      </div>
    </div>
  );
}
