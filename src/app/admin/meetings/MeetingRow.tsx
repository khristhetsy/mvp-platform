"use client";

// One meeting-session row with a status badge and an options menu (open board,
// mark closed / reopen, delete with confirmation). Status reflects the real
// session lifecycle — a closed meeting no longer reads "Live".
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { confirmDialog } from "@/components/ui/ConfirmDialog";

interface Session { id: string; meeting_name: string; session_date: string; status: string }

const STATUS: Record<string, { bg: string; color: string; border?: string; label: string }> = {
  live: { bg: "#E1F5EE", color: "#0F6E56", label: "Live" },
  closed: { bg: "#F1EFE8", color: "#5F5E5A", border: "0.5px solid var(--border)", label: "Closed" },
  summarized: { bg: "#E6F1FB", color: "#185FA5", label: "Summarized" },
  scheduled: { bg: "#F1EFE8", color: "#5F5E5A", border: "0.5px solid var(--border)", label: "Scheduled" },
};

export function MeetingRow({ session }: { session: Session }) {
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setMenu(false); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const st = STATUS[session.status] ?? STATUS.scheduled;
  const dateLabel = new Date(`${session.session_date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

  const setStatus = async (status: "closed" | "live") => {
    setMenu(false); setBusy(true);
    await fetch(`/api/admin/meetings/${session.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }).catch(() => {});
    setBusy(false); router.refresh();
  };
  const remove = async () => {
    setMenu(false);
    if (!(await confirmDialog({ message: "Delete this meeting? Its agenda entries and tasks are removed too. This cannot be undone.", danger: true, confirmLabel: "Delete" }))) return;
    setBusy(true);
    await fetch(`/api/admin/meetings/${session.id}`, { method: "DELETE" }).catch(() => {});
    setBusy(false); router.refresh();
  };

  const item = { fontSize: 12.5, padding: "8px 10px", borderRadius: 6, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", background: "none", border: "none", width: "100%", textAlign: "left" as const, color: "inherit" };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 0.7fr 44px", padding: "10px 14px", borderTop: "0.5px solid #F1F4F9", alignItems: "center", opacity: busy ? 0.5 : 1 }}>
      <Link href={`/admin/meetings/${session.id}`} style={{ fontSize: 12.5, fontWeight: 600, color: "#0A1A40", textDecoration: "none" }}>{session.meeting_name}</Link>
      <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{dateLabel}</div>
      <div><span style={{ fontSize: 10.5, fontWeight: 600, background: st.bg, color: st.color, border: st.border, borderRadius: 6, padding: "2px 8px" }}>{st.label}</span></div>
      <div ref={ref} style={{ position: "relative", justifySelf: "end" }}>
        <button aria-label="Meeting options" onClick={() => setMenu((m) => !m)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", fontSize: 18, padding: "2px 6px", borderRadius: 6 }}>
          <i className="ti ti-dots" aria-hidden="true" />
        </button>
        {menu && (
          <div style={{ position: "absolute", right: 0, top: "100%", marginTop: 4, width: 190, background: "#fff", border: "0.5px solid var(--border)", borderRadius: 10, padding: 5, boxShadow: "0 8px 24px rgb(12 35 64 / 0.12)", zIndex: 20 }}>
            <Link href={`/admin/meetings/${session.id}`} style={item as React.CSSProperties}><i className="ti ti-layout-board" aria-hidden="true" /> Open board</Link>
            {session.status === "closed" ? (
              <button onClick={() => void setStatus("live")} style={item}><i className="ti ti-calendar-clock" aria-hidden="true" /> Reopen</button>
            ) : (
              <button onClick={() => void setStatus("closed")} style={item}><i className="ti ti-circle-check" aria-hidden="true" /> Mark as closed</button>
            )}
            <div style={{ height: "0.5px", background: "var(--border)", margin: "4px 6px" }} />
            <button onClick={() => void remove()} style={{ ...item, color: "#A32D2D" }}><i className="ti ti-trash" aria-hidden="true" /> Delete meeting</button>
          </div>
        )}
      </div>
    </div>
  );
}
