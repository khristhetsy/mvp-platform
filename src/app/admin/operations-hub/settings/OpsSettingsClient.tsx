"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Settings = { onboardingSlaDays: number; diligenceSlaDays: number; defaultManagerId: string | null; emailEscalations: boolean };
type Assignee = { id: string; name: string };

const TOOLS = [
  { icon: "ti-upload", label: "Import companies / investors", href: "/admin/imports" },
  { icon: "ti-refresh", label: "Contact sync connectors", href: "/admin/crm/connectors" },
  { icon: "ti-shield-lock", label: "RBAC roles & permissions", href: "/admin/users/permissions" },
  { icon: "ti-history", label: "Audit log", href: "/admin/audit" },
];

export function OpsSettingsClient() {
  const [s, setS] = useState<Settings | null>(null);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/operations/settings");
    if (!res.ok) return;
    const data = await res.json();
    setS(data.settings);
    setAssignees(data.assignees ?? []);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load settings on mount
  useEffect(() => { void load(); }, [load]);

  async function save() {
    if (!s) return;
    setSaving(true); setMsg(null);
    try {
      const res = await fetch("/api/operations/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Save failed."); }
      setMsg("Saved.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed.");
    } finally { setSaving(false); }
  }

  const inp: React.CSSProperties = { fontSize: 12, padding: "6px 8px", borderRadius: 7, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" };
  const row: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10 };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 12 }}>Escalation SLAs</div>
        {!s ? <p style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Loading…</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={row}><span style={{ flex: 1, fontSize: 12, color: "var(--muted-foreground)" }}>Onboarding overdue after</span>
              <input type="number" min={1} max={90} value={s.onboardingSlaDays} onChange={(e) => setS({ ...s, onboardingSlaDays: Number(e.target.value) })} style={{ ...inp, width: 56, textAlign: "center" }} /><span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>days</span></div>
            <div style={row}><span style={{ flex: 1, fontSize: 12, color: "var(--muted-foreground)" }}>Diligence stage overdue after</span>
              <input type="number" min={1} max={90} value={s.diligenceSlaDays} onChange={(e) => setS({ ...s, diligenceSlaDays: Number(e.target.value) })} style={{ ...inp, width: 56, textAlign: "center" }} /><span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>days</span></div>
            <div style={row}><span style={{ flex: 1, fontSize: 12, color: "var(--muted-foreground)" }}>Default escalation manager</span>
              <select value={s.defaultManagerId ?? ""} onChange={(e) => setS({ ...s, defaultManagerId: e.target.value || null })} style={{ ...inp, maxWidth: 180 }}>
                <option value="">Whole staff pool</option>
                {assignees.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select></div>
            <div style={row}><span style={{ flex: 1, fontSize: 12, color: "var(--muted-foreground)" }}>Also email escalations</span>
              <button onClick={() => setS({ ...s, emailEscalations: !s.emailEscalations })} aria-label="Toggle email" style={{ width: 36, height: 20, borderRadius: 10, border: "none", background: s.emailEscalations ? "#2E78F5" : "var(--muted)", position: "relative", cursor: "pointer" }}>
                <span style={{ position: "absolute", top: 2, left: s.emailEscalations ? 18 : 2, width: 16, height: 16, background: "#fff", borderRadius: "50%", transition: "left .12s" }} />
              </button></div>
            <div style={{ fontSize: 10.5, color: "var(--muted-foreground)" }}>Email delivery activates once the transactional sender is on a verified domain — for now escalations are in-app.</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
              <button onClick={save} disabled={saving} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", opacity: saving ? 0.5 : 1 }}>{saving ? "Saving…" : "Save"}</button>
              {msg && <span style={{ fontSize: 11.5, color: msg === "Saved." ? "#0F6E56" : "#A32D2D" }}>{msg}</span>}
            </div>
          </div>
        )}
      </div>

      <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 12 }}>Tools</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {TOOLS.map((t, i) => (
            <Link key={t.href} href={t.href} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: i > 0 ? "0.5px solid #eef1f5" : "none", textDecoration: "none", color: "var(--foreground)" }}>
              <span style={{ color: "#185FA5" }}><i className={`ti ${t.icon}`} aria-hidden="true" /></span>
              <span style={{ flex: 1, fontSize: 12.5 }}>{t.label}</span>
              <span style={{ color: "var(--muted-foreground)" }}>›</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
