"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/** Short local timezone abbreviation (e.g. "PDT"), resolved client-side. */
function localTzAbbr(): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZoneName: "short" }).formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch { return ""; }
}

/** Next Thursday (the management meeting's day) in local time, YYYY-MM-DD. */
function nextThursday(): string {
  const d = new Date();
  const delta = (4 - d.getDay() + 7) % 7 || 7; // 4 = Thursday; always a future one
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function NewSessionButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(nextThursday());
  const [time, setTime] = useState("09:00");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tz, setTz] = useState("");
  // Resolve on the client after mount so SSR and client markup match (no hydration mismatch).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setTz(localTzAbbr()); }, []);

  const create = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/admin/meetings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ meetingKey: "mgmt", sessionDate: date, sessionTime: time }) });
      const d = await r.json();
      if (!r.ok || !d.sessionId) { setErr(typeof d.error === "string" ? d.error : "Failed to create session."); return; }
      router.push(`/admin/meetings/${d.sessionId}`);
    } catch { setErr("Failed to create session."); }
    finally { setBusy(false); }
  };

  // Collapsed: just the button. Clicking it reveals the date + time picker inline.
  if (!open) {
    return (
      <button onClick={() => { setErr(null); setOpen(true); }} style={{ fontSize: 12.5, fontWeight: 600, color: "#fff", background: "#1A6CE4", border: "none", borderRadius: 8, padding: "7px 13px", cursor: "pointer" }}>New meeting session</button>
    );
  }

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} autoFocus style={{ fontSize: 12.5, padding: "6px 9px", borderRadius: 8, border: "0.5px solid var(--border)" }} />
      <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Meeting time" style={{ fontSize: 12.5, padding: "6px 9px", borderRadius: 8, border: "0.5px solid var(--border)" }} />
      {tz && <span style={{ fontSize: 12, color: "var(--muted-foreground)" }} title="Your local time zone">{tz}</span>}
      <button onClick={() => void create()} disabled={busy} style={{ fontSize: 12.5, fontWeight: 600, color: "#fff", background: "#1A6CE4", border: "none", borderRadius: 8, padding: "7px 13px", cursor: "pointer" }}>{busy ? "Creating…" : "Create"}</button>
      <button onClick={() => { setOpen(false); setErr(null); }} disabled={busy} style={{ fontSize: 12.5, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer" }}>Cancel</button>
      {err && <span style={{ fontSize: 12, color: "#A32D2D" }}>{err}</span>}
    </div>
  );
}
