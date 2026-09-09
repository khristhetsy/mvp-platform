"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Booking } from "@/lib/scheduling/bookings";

const STATUS: Record<string, { label: string; bg: string; color: string }> = {
  confirmed: { label: "Confirmed", bg: "#E8F5F1", color: "#0F6E56" },
  completed: { label: "Completed", bg: "#E6F1FB", color: "#185FA5" },
  cancelled: { label: "Cancelled", bg: "#FCEBEB", color: "#A32D2D" },
  no_show: { label: "No-show", bg: "#F1EFE8", color: "#5F5E5A" },
};

function fmtRange(startIso: string, endIso: string, tz: string | null): { day: string; time: string } {
  const s = new Date(startIso), e = new Date(endIso);
  const opts: Intl.DateTimeFormatOptions = tz ? { timeZone: tz } : {};
  const day = s.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric", ...opts });
  const t = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", ...opts });
  return { day, time: `${t(s)} – ${t(e)}${tz ? ` ${tz}` : ""}` };
}

export function BookingsClient({ bookings }: { bookings: Booking[] }) {
  const [selected, setSelected] = useState<Booking | null>(bookings[0] ?? null);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return bookings;
    return bookings.filter((b) => `${b.booker_name ?? ""} ${b.booker_email ?? ""} ${b.event_type ?? ""}`.toLowerCase().includes(n));
  }, [bookings, q]);

  const card: React.CSSProperties = { background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12 };

  return (
    <div style={{ padding: "0 24px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>Bookings</h2>
          <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "2px 0 0" }}>{bookings.length} total · from your iCapOS scheduler</p>
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search invitee, email, event…" style={{ fontSize: 12.5, padding: "7px 11px", borderRadius: 8, border: "0.5px solid var(--border)", minWidth: 240 }} />
      </div>

      {bookings.length === 0 ? (
        <div style={{ ...card, padding: "40px 24px", textAlign: "center", fontSize: 13, color: "var(--muted-foreground)" }}>
          No bookings yet. They appear here when someone books through your scheduling link.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16, alignItems: "start" }}>
          {/* list */}
          <div style={{ ...card, overflow: "hidden" }}>
            {filtered.map((b, i) => {
              const st = STATUS[b.status] ?? STATUS.confirmed;
              const { day } = fmtRange(b.start_time, b.end_time, b.timezone);
              const on = selected?.id === b.id;
              return (
                <button key={b.id} onClick={() => setSelected(b)} style={{ display: "block", width: "100%", textAlign: "left", padding: "11px 13px", borderTop: i ? "0.5px solid #eef1f5" : "none", background: on ? "#F5F9FF" : "transparent", border: "none", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--foreground)", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.booker_name ?? b.booker_email ?? "Invitee"}</span>
                    <span style={{ fontSize: 9.5, background: st.bg, color: st.color, borderRadius: 20, padding: "1px 7px" }}>{st.label}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.event_type ?? "Meeting"}</div>
                  <div style={{ fontSize: 10.5, color: "var(--muted-foreground)", marginTop: 1 }}>{day}</div>
                </button>
              );
            })}
          </div>

          {/* detail */}
          {selected ? <BookingDetail b={selected} /> : <div style={{ ...card, padding: 24, fontSize: 13, color: "var(--muted-foreground)" }}>Select a booking.</div>}
        </div>
      )}
    </div>
  );
}

function BookingDetail({ b }: { b: Booking }) {
  const st = STATUS[b.status] ?? STATUS.confirmed;
  const { day, time } = fmtRange(b.start_time, b.end_time, b.timezone);
  const mins = Math.round((new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / 60000);
  const lbl = { fontSize: 10, textTransform: "uppercase" as const, letterSpacing: ".04em", color: "var(--muted-foreground)", margin: "0 0 3px" };

  return (
    <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ background: "var(--muted)", padding: "13px 16px", borderBottom: "0.5px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Booking</span>
          {b.event_type ? <span style={{ fontSize: 10.5, color: "#185FA5", background: "#E6F1FB", borderRadius: 20, padding: "2px 9px" }}>{b.event_type}</span> : null}
          <span style={{ marginLeft: "auto", fontSize: 10.5, color: st.color, background: st.bg, borderRadius: 20, padding: "2px 9px" }}>● {st.label}</span>
        </div>
        <p style={{ fontSize: 11.5, color: "var(--muted-foreground)", margin: "5px 0 0" }}>Booked {new Date(b.created_at).toLocaleString()}{b.host_name ? ` · host ${b.host_name}` : ""}</p>
      </div>

      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <p style={lbl}>Invitee</p>
            <p style={{ fontSize: 12.5, fontWeight: 500, margin: 0 }}>{b.booker_name ?? "—"}</p>
            {b.booker_email ? <p style={{ fontSize: 11.5, color: "#185FA5", margin: "2px 0 0" }}>{b.booker_email}</p> : null}
            {b.booker_phone ? <p style={{ fontSize: 11.5, color: "var(--muted-foreground)", margin: "2px 0 0" }}>{b.booker_phone}</p> : null}
            {b.timezone ? <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: "2px 0 0" }}>{b.timezone}</p> : null}
          </div>
          <div>
            <p style={lbl}>When</p>
            <p style={{ fontSize: 12.5, fontWeight: 500, margin: 0 }}>{day}</p>
            <p style={{ fontSize: 11.5, color: "var(--muted-foreground)", margin: "2px 0 0" }}>{time}</p>
            <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: "2px 0 0" }}>{mins} min</p>
          </div>
        </div>

        {b.meet_url ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--muted)", borderRadius: 8, padding: "9px 11px" }}>
            <i className="ti ti-video" aria-hidden="true" />
            <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Google Meet</span>
            <a href={b.meet_url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: "auto", background: "#2E78F5", color: "#fff", borderRadius: 6, padding: "5px 12px", fontSize: 11.5, fontWeight: 500, textDecoration: "none" }}>Join now</a>
          </div>
        ) : null}

        {b.answers.length > 0 ? (
          <div>
            <p style={lbl}>Intake answers</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {b.answers.map((a, i) => (
                <div key={i}>
                  <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: 0 }}>{a.label}</p>
                  <p style={{ fontSize: 12.5, fontWeight: 500, color: "var(--foreground)", margin: "1px 0 0", whiteSpace: "pre-wrap" }}>{a.value}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {b.note ? (
          <div><p style={lbl}>Note</p><p style={{ fontSize: 12, color: "var(--foreground)", margin: 0, whiteSpace: "pre-wrap" }}>{b.note}</p></div>
        ) : null}

        {b.contact_crm_id ? (
          <div style={{ paddingTop: 4 }}>
            <Link href={`/admin/sales/contacts/${b.contact_crm_id}`} style={{ fontSize: 12, color: "#185FA5", background: "#EEF4FF", border: "0.5px solid #B5D4F4", borderRadius: 8, padding: "7px 13px", textDecoration: "none" }}>Open contact →</Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
