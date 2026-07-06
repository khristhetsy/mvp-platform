"use client";

import { useCallback, useEffect, useState } from "react";

type Settings = { remindTaskDue: boolean; remindStalled: boolean; remindClosePassed: boolean; stalledDays: number };

function ToggleSwitch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label="toggle" style={{ width: 36, height: 20, borderRadius: 10, border: "none", background: on ? "#2E78F5" : "var(--muted)", position: "relative", cursor: "pointer" }}>
      <span style={{ position: "absolute", top: 2, left: on ? 18 : 2, width: 16, height: 16, background: "#fff", borderRadius: "50%", transition: "left .12s" }} />
    </button>
  );
}

export function SettingsNotificationsClient() {
  const [s, setS] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/sales/settings");
    if (res.ok) { const d = (await res.json()).settings; setS({ remindTaskDue: d.remindTaskDue, remindStalled: d.remindStalled, remindClosePassed: d.remindClosePassed, stalledDays: d.stalledDays }); }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- load on mount
  useEffect(() => { void load(); }, [load]);

  async function save(next: Settings) {
    setSaving(true); setMsg(null);
    try {
      const res = await fetch("/api/sales/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed.");
      setMsg("Saved.");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Save failed."); } finally { setSaving(false); }
  }

  if (!s) return <p style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>Loading…</p>;

  function toggle(field: "remindTaskDue" | "remindStalled" | "remindClosePassed") {
    const next = { ...s!, [field]: !s![field] };
    setS(next); void save(next);
  }

  const rows: { label: string; field: "remindTaskDue" | "remindStalled" | "remindClosePassed" }[] = [
    { label: "Remind assignee when a task is due", field: "remindTaskDue" },
    { label: "Notify on stalled opportunities", field: "remindStalled" },
    { label: "Notify owner when close date passes", field: "remindClosePassed" },
  ];

  return (
    <div style={{ flex: 1, background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, padding: 16, maxWidth: 460 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 12 }}>Reminder notifications</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
        {rows.map((r) => (
          <div key={r.field} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ flex: 1, fontSize: 12, color: "var(--muted-foreground)" }}>{r.label}</span>
            <ToggleSwitch on={s[r.field]} onClick={() => toggle(r.field)} />
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ flex: 1, fontSize: 12, color: "var(--muted-foreground)" }}>Opportunity is stalled after</span>
          <input type="number" min={1} max={90} value={s.stalledDays} onChange={(e) => { const next = { ...s, stalledDays: Number(e.target.value) }; setS(next); }} onBlur={() => void save(s)} style={{ width: 56, textAlign: "center", fontSize: 12, padding: "5px 8px", borderRadius: 7, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }} />
          <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>days</span>
        </div>
      </div>
      <div style={{ fontSize: 10.5, color: "var(--muted-foreground)", marginTop: 12, paddingTop: 10, borderTop: "0.5px solid #eef1f5" }}>Reminders send in-app to the owner. Email activates once the transactional sender is on a verified domain.</div>
      {msg && <div style={{ fontSize: 11.5, color: msg === "Saved." ? "#0F6E56" : "#A32D2D", marginTop: 10 }}>{saving ? "Saving…" : msg}</div>}
    </div>
  );
}
