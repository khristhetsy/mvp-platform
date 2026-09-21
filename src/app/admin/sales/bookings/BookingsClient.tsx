"use client";

import { Fragment, useMemo, useState } from "react";
import { OdooSearchBar, EMPTY_SEARCH, textMatch, type SearchState } from "@/components/admin/OdooSearchBar";
import { ToolbarGear, downloadCsv, type GearItem } from "@/components/admin/ToolbarGear";
import { SalesViewControl } from "@/app/admin/sales/SalesViewControl";
import Link from "next/link";
import type { Booking } from "@/lib/scheduling/bookings";
import { SOURCE_CONFIDENCE_LABEL, isHighConfidence } from "@/lib/attribution/source";
import type { CampaignOption } from "@/lib/attribution/resolve";

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

function initials(name: string | null, email: string | null): string {
  const src = (name ?? email ?? "?").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

// Google Calendar "add event" template link (no API — just a prefilled URL).
function gcalUrl(b: Booking): string {
  const z = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: b.event_type ?? "Meeting",
    dates: `${z(b.start_time)}/${z(b.end_time)}`,
    details: [b.meet_url ? `Google Meet: ${b.meet_url}` : "", b.note ?? ""].filter(Boolean).join("\n"),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function BookingsClient({ bookings: initial, campaigns = [], canExport = false }: { bookings: Booking[]; campaigns?: CampaignOption[]; canExport?: boolean }) {
  const [bookings, setBookings] = useState<Booking[]>(initial);
  const [selectedId, setSelectedId] = useState<string | null>(initial[0]?.id ?? null);
  const [search, setSearch] = useState<SearchState>({ ...EMPTY_SEARCH, groupBy: "none" });

  const hostOptions = useMemo(() => [...new Set(bookings.map((b) => b.host_name ?? b.host_email ?? "Unknown host"))].sort(), [bookings]);
  const eventOptions = useMemo(() => [...new Set(bookings.map((b) => b.event_type ?? "Meeting"))].sort(), [bookings]);
  const searchFields = useMemo(() => [
    { key: "host", label: "Host", options: hostOptions },
    { key: "event", label: "Event type", options: eventOptions },
  ], [hostOptions, eventOptions]);
  const filtered = useMemo(() => {
    const { q, quick, fields } = search;
    const now = new Date().getTime();
    return bookings.filter((b) => {
      if (!textMatch(q, b.booker_name, b.booker_email, b.booker_company, b.event_type)) return false;
      const start = new Date(b.start_time).getTime();
      if (quick.includes("upcoming") && !(start >= now && b.status !== "cancelled")) return false;
      if (quick.includes("past") && start >= now) return false;
      if (quick.includes("cancelled") && b.status !== "cancelled") return false;
      if (quick.includes("no_show") && b.status !== "no_show") return false;
      if (quick.includes("completed") && b.status !== "completed") return false;
      if (fields.host?.length && !fields.host.includes(b.host_name ?? b.host_email ?? "Unknown host")) return false;
      if (fields.event?.length && !fields.event.includes(b.event_type ?? "Meeting")) return false;
      return true;
    });
  }, [bookings, search]);
  const groupOf = (b: Booking): string => {
    const g = search.groupBy || "none";
    if (g === "host") return b.host_name ?? b.host_email ?? "Unknown host";
    if (g === "event") return b.event_type ?? "Meeting";
    if (g === "week") { const d = new Date(b.start_time); const mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return `Week of ${mon.toISOString().slice(0, 10)}`; }
    return "";
  };
  // Grouped: keep rows of one group together (list is otherwise newest-first).
  const rows = search.groupBy && search.groupBy !== "none" ? [...filtered].sort((a, b) => groupOf(a).localeCompare(groupOf(b))) : filtered;

  const selected = bookings.find((b) => b.id === selectedId) ?? null;
  const onUpdated = (b: Booking) => setBookings((prev) => prev.map((x) => (x.id === b.id ? b : x)));

  const card: React.CSSProperties = { background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12 };

  return (
    <div style={{ padding: "0 24px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
        <ToolbarGear heading="Bookings" items={[
          ...(canExport ? [{ key: "export", icon: "ti-download", label: "Export all", hint: `${filtered.length.toLocaleString()} matching`, onClick: () => downloadCsv(`bookings-${new Date().toISOString().slice(0, 10)}.csv`, ["Invitee", "Email", "Company", "Event", "Host", "Start", "End", "Status"], filtered.map((b) => [b.booker_name, b.booker_email, b.booker_company, b.event_type, b.host_name ?? b.host_email ?? "", b.start_time, b.end_time, b.status])) } as GearItem] : []),
          { key: "events", icon: "ti-calendar-event", label: "Event types and scheduling link", href: "/admin/sales/settings" },
        ]} />
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>Bookings</h2>
          <p style={{ fontSize: 11.5, color: "var(--muted-foreground)", margin: "1px 0 0" }}>{bookings.length} total · from your iCapOS scheduler</p>
        </div>
        <OdooSearchBar scope="bookings" state={search} onChange={setSearch}
          quick={[{ key: "upcoming", label: "Upcoming" }, { key: "past", label: "Past" }, { key: "completed", label: "Completed", sep: true }, { key: "cancelled", label: "Cancelled" }, { key: "no_show", label: "No-show" }]}
          fields={searchFields}
          groups={[{ id: "none", label: "None" }, { id: "host", label: "Host" }, { id: "event", label: "Event type" }, { id: "week", label: "Week" }]}
          noGroupId="none" placeholder="Search invitee, email, event…" width={460} />
        <SalesViewControl />
      </div>

      {bookings.length === 0 ? (
        <div style={{ ...card, padding: "40px 24px", textAlign: "center", fontSize: 13, color: "var(--muted-foreground)" }}>
          No bookings yet. They appear here when someone books through your scheduling link.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16, alignItems: "start" }}>
          <div style={{ ...card, overflow: "hidden" }}>
            {rows.length === 0 && <div style={{ padding: 18, fontSize: 12.5, color: "var(--muted-foreground)", textAlign: "center" }}>No bookings match.</div>}
            {rows.map((b, i) => {
              const st = STATUS[b.status] ?? STATUS.confirmed;
              const { day } = fmtRange(b.start_time, b.end_time, b.timezone);
              const on = selectedId === b.id;
              const gk = groupOf(b);
              const newGroup = gk && (i === 0 || groupOf(rows[i - 1]) !== gk);
              return (<Fragment key={b.id}>
                {newGroup && <div style={{ padding: "6px 13px", background: "var(--muted)", borderTop: i ? "0.5px solid #eef1f5" : "none", fontSize: 11, fontWeight: 600 }}>{gk}</div>}
                <button onClick={() => setSelectedId(b.id)} style={{ display: "block", width: "100%", textAlign: "left", padding: "11px 13px", borderTop: i ? "0.5px solid #eef1f5" : "none", background: on ? "#F5F9FF" : "transparent", border: "none", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--foreground)", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.booker_name ?? b.booker_email ?? "Invitee"}</span>
                    <span style={{ fontSize: 9.5, background: st.bg, color: st.color, borderRadius: 20, padding: "1px 7px" }}>{st.label}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.event_type ?? "Meeting"}</div>
                  <div style={{ fontSize: 10.5, color: "var(--muted-foreground)", marginTop: 1 }}>{day}</div>
                </button>
              </Fragment>);
            })}
          </div>

          {selected ? <BookingDetail key={selected.id} b={selected} campaigns={campaigns} onUpdated={onUpdated} /> : <div style={{ ...card, padding: 24, fontSize: 13, color: "var(--muted-foreground)" }}>Select a booking.</div>}
        </div>
      )}
    </div>
  );
}

function BookingDetail({ b, campaigns, onUpdated }: { b: Booking; campaigns: CampaignOption[]; onUpdated: (b: Booking) => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [noteVal, setNoteVal] = useState(b.note ?? "");
  const [noteEditing, setNoteEditing] = useState(false);
  const [noteBusy, setNoteBusy] = useState(false);

  const st = STATUS[b.status] ?? STATUS.confirmed;
  const { day, time } = fmtRange(b.start_time, b.end_time, b.timezone);
  const mins = Math.round((new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / 60000);
  const lbl = { fontSize: 10, textTransform: "uppercase" as const, letterSpacing: ".04em", color: "var(--muted-foreground)", margin: "0 0 3px" };
  const isConfirmed = b.status === "confirmed";
  // Calendly shows both sides' clocks: the booking timezone + the viewer's own.
  const localTz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : null;
  const showLocal = !!(b.timezone && localTz && b.timezone !== localTz);
  const localTime = showLocal ? fmtRange(b.start_time, b.end_time, localTz).time : null;

  async function saveNote() {
    setNoteBusy(true);
    try {
      const res = await fetch(`/api/scheduling/bookings/${b.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note: noteVal.trim() || null }) });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.booking) { onUpdated(j.booking as Booking); setNoteEditing(false); }
    } finally { setNoteBusy(false); }
  }

  /**
   * The manual attribution override.
   *
   * Last rung of the ladder and the only one that beats a machine: you sat in
   * the meeting, so you know where they came from. Recorded with who set it,
   * which is why the funnel can still separate "we tracked this" from
   * "somebody told us".
   */
  async function setSource(tag: string | null) {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/scheduling/bookings/${b.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceTag: tag }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.booking) { setMsg(j.error ?? "Couldn’t set the source."); return; }
      onUpdated(j.booking as Booking);
      setMsg(tag ? "Source set." : "Source cleared.");
    } catch { setMsg("Network error — not updated."); } finally { setBusy(false); }
  }

  async function setStatus(status: "completed" | "cancelled" | "no_show" | "confirmed") {
    setBusy(true); setMsg(null); setConfirmCancel(false);
    try {
      const res = await fetch(`/api/scheduling/bookings/${b.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.booking) { setMsg(j.error ?? "Couldn’t update the booking."); return; }
      onUpdated(j.booking as Booking);
      setMsg(status === "cancelled" ? "Cancelled. Invitee notified, calendar cleared." : "Updated.");
    } catch { setMsg("Network error — not updated."); } finally { setBusy(false); }
  }

  const actBtn: React.CSSProperties = { fontSize: 11.5, fontWeight: 500, background: "transparent", border: "0.5px solid #cdd9ec", borderRadius: 7, padding: "6px 12px", cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.5 : 1, color: "var(--foreground)" };

  return (
    <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ background: "var(--muted)", padding: "13px 16px", borderBottom: "0.5px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{b.event_type ?? "Meeting"}</span>
          <span style={{ fontSize: 10.5, color: "#185FA5", background: "#E6F1FB", borderRadius: 20, padding: "2px 9px" }}>{mins} min</span>
          <span style={{ marginLeft: "auto", fontSize: 10.5, color: st.color, background: st.bg, borderRadius: 20, padding: "2px 9px" }}>● {st.label}</span>
        </div>
        <p style={{ fontSize: 11.5, color: "var(--muted-foreground)", margin: "5px 0 0" }}>Booked {new Date(b.created_at).toLocaleString()}{b.host_name ? ` · host ${b.host_name}` : ""}</p>
      </div>

      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Invitee */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: "50%", background: "#EEF2FF", color: "#4338CA", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 14, flexShrink: 0 }}>{initials(b.booker_name, b.booker_email)}</div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>{b.booker_name ?? "Invitee"}{b.booker_company ? <span style={{ fontWeight: 400, color: "var(--muted-foreground)" }}> · {b.booker_company}</span> : null}</p>
            <p style={{ fontSize: 11.5, color: "#185FA5", margin: "1px 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{[b.booker_email, b.booker_phone].filter(Boolean).join(" · ") || "—"}</p>
            {b.timezone ? <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: "1px 0 0" }}>{b.timezone}</p> : null}
          </div>
          {b.contact_crm_id ? (
            <Link href={`/admin/sales/contacts/${b.contact_crm_id}`} style={{ marginLeft: "auto", fontSize: 11, fontWeight: 500, color: "#4338CA", background: "#EEF2FF", border: "0.5px solid #C7D2FE", borderRadius: 7, padding: "6px 11px", textDecoration: "none", whiteSpace: "nowrap" }}><i className="ti ti-external-link" aria-hidden="true" /> Contact</Link>
          ) : null}
        </div>

        {/* When + Location */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ background: "var(--muted)", borderRadius: 10, padding: "10px 12px" }}>
            <p style={lbl}><i className="ti ti-calendar" aria-hidden="true" /> When</p>
            <p style={{ fontSize: 12.5, fontWeight: 500, margin: 0 }}>{day} · {mins} min</p>
            <p style={{ fontSize: 11.5, color: "var(--muted-foreground)", margin: "2px 0 0" }}>{time}{showLocal ? " · booking time" : ""}</p>
            {showLocal ? <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: "1px 0 0" }}>{localTime} · your time</p> : null}
            <a href={gcalUrl(b)} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 6, fontSize: 10.5, color: "#185FA5", textDecoration: "none" }}><i className="ti ti-calendar-plus" aria-hidden="true" /> Add to calendar</a>
          </div>
          <div style={{ background: "var(--muted)", borderRadius: 10, padding: "10px 12px" }}>
            <p style={lbl}><i className="ti ti-video" aria-hidden="true" /> Location</p>
            {b.meet_url ? (
              <>
                <p style={{ fontSize: 12.5, fontWeight: 500, margin: 0 }}>Google Meet</p>
                <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: "2px 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.meet_url.replace(/^https?:\/\//, "")}</p>
                <a href={b.meet_url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 6, fontSize: 10.5, fontWeight: 500, color: "#fff", background: "#2E78F5", borderRadius: 6, padding: "4px 10px", textDecoration: "none" }}>Join</a>
              </>
            ) : <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0 }}>No meeting link</p>}
          </div>
        </div>

        {/* Where this meeting came from */}
        <div style={{ background: "var(--muted)", borderRadius: 10, padding: "10px 12px" }}>
          <p style={lbl}><i className="ti ti-target-arrow" aria-hidden="true" /> Source</p>
          {b.source_tag ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12.5, fontWeight: 500 }}>
                {campaigns.find((c) => c.sourceTag === b.source_tag)?.name ?? b.source_tag}
              </span>
              {b.source_confidence ? (
                <span
                  title={SOURCE_CONFIDENCE_LABEL[b.source_confidence]}
                  style={{
                    fontSize: 10, borderRadius: 20, padding: "2px 8px",
                    // Tracked and self-reported are not the same evidence, and
                    // the badge says which so a soft number is never read as hard.
                    background: isHighConfidence(b.source_confidence) ? "#ECFDF5" : "#FFF7ED",
                    color: isHighConfidence(b.source_confidence) ? "#065F46" : "#9A3412",
                  }}
                >
                  {SOURCE_CONFIDENCE_LABEL[b.source_confidence]}
                </span>
              ) : null}
            </div>
          ) : (
            <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0 }}>
              Unattributed — nothing was captured when this was booked.
            </p>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 7, flexWrap: "wrap" }}>
            <select
              value={b.source_tag ?? ""}
              disabled={busy}
              onChange={(e) => void setSource(e.target.value || null)}
              style={{ fontSize: 11.5, padding: "5px 8px", borderRadius: 7, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)", maxWidth: 230 }}
            >
              <option value="">Unattributed</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.sourceTag}>{c.name}</option>
              ))}
            </select>
            <span style={{ fontSize: 10.5, color: "var(--muted-foreground)" }}>
              {b.source_confidence === "manual" && b.source_set_at
                ? `Set by hand ${new Date(b.source_set_at).toLocaleDateString()}`
                : "Setting this by hand overrides what was captured"}
            </span>
          </div>
        </div>

        {/* Questions */}
        {b.answers.length > 0 ? (
          <div>
            <p style={lbl}>Questions</p>
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

        {/* Meeting notes — private, editable */}
        <div>
          <p style={lbl}>Meeting notes</p>
          {noteEditing ? (
            <div>
              <textarea value={noteVal} onChange={(e) => setNoteVal(e.target.value)} rows={3} placeholder="Add a private note about this meeting…" style={{ width: "100%", boxSizing: "border-box", fontSize: 12, border: "0.5px solid #4338CA", borderRadius: 7, padding: "6px 8px", resize: "vertical", lineHeight: 1.5 }} />
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <button onClick={saveNote} disabled={noteBusy} style={{ fontSize: 11, fontWeight: 500, color: "#fff", background: "#4338CA", border: "none", borderRadius: 6, padding: "5px 12px", cursor: noteBusy ? "not-allowed" : "pointer", opacity: noteBusy ? 0.5 : 1 }}>Save note</button>
                <button onClick={() => { setNoteVal(b.note ?? ""); setNoteEditing(false); }} disabled={noteBusy} style={{ fontSize: 11, color: "var(--foreground)", background: "transparent", border: "0.5px solid #cdd9ec", borderRadius: 6, padding: "5px 12px", cursor: "pointer" }}>Cancel</button>
              </div>
            </div>
          ) : (
            <p onClick={() => setNoteEditing(true)} title="Click to edit" style={{ fontSize: 12, margin: 0, whiteSpace: "pre-wrap", cursor: "pointer", color: b.note ? "var(--foreground)" : "var(--muted-foreground)", fontStyle: b.note ? "normal" : "italic" }}>{b.note || "Add a private note about this meeting…"}</p>
          )}
        </div>

        {/* Activity */}
        <div>
          <p style={lbl}>Activity</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <ActivityRow color="#0F6E56" text={`Booked${b.booker_name ? ` by ${b.booker_name}` : ""}`} when={new Date(b.created_at).toLocaleString()} />
            <ActivityRow color="#B4B2A9" text="Confirmation emails sent" when={new Date(b.created_at).toLocaleString()} />
            {!isConfirmed ? <ActivityRow color={st.color} text={st.label} when="" /> : null}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", borderTop: "0.5px solid var(--border)", paddingTop: 12, alignItems: "center" }}>
          {isConfirmed ? (
            <>
              <button onClick={() => setShowReschedule((s) => !s)} disabled={busy} style={actBtn}><i className="ti ti-calendar-event" aria-hidden="true" /> Reschedule</button>
              <button onClick={() => setStatus("completed")} disabled={busy} style={actBtn}><i className="ti ti-check" aria-hidden="true" /> Mark completed</button>
              <button onClick={() => setStatus("no_show")} disabled={busy} style={{ ...actBtn, color: "#5F5E5A" }}><i className="ti ti-user-x" aria-hidden="true" /> No-show</button>
              {confirmCancel ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <button onClick={() => setStatus("cancelled")} disabled={busy} style={{ ...actBtn, color: "#fff", background: "#A32D2D", border: "none" }}>Confirm cancel</button>
                  <button onClick={() => setConfirmCancel(false)} disabled={busy} style={actBtn}>Keep</button>
                </span>
              ) : (
                <button onClick={() => setConfirmCancel(true)} disabled={busy} style={{ ...actBtn, color: "#A32D2D", border: "0.5px solid #F0999577" }}><i className="ti ti-x" aria-hidden="true" /> Cancel</button>
              )}
            </>
          ) : (
            <button onClick={() => setStatus("confirmed")} disabled={busy} style={actBtn}><i className="ti ti-rotate" aria-hidden="true" /> Reconfirm</button>
          )}
          {b.booker_email ? (
            <a href={`mailto:${b.booker_email}`} style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 500, color: "#fff", background: "#4338CA", borderRadius: 7, padding: "6px 12px", textDecoration: "none" }}><i className="ti ti-mail" aria-hidden="true" /> Email invitee</a>
          ) : null}
        </div>

        {showReschedule ? (
          <div style={{ fontSize: 11.5, color: "#854F0B", background: "#FAEEDA", border: "0.5px solid #F4D9A0", borderRadius: 8, padding: "9px 11px" }}>
            Rescheduling from here is coming soon. For now, cancel this booking (the invitee is notified) and share your scheduling link to rebook.
          </div>
        ) : null}
        {msg ? <p style={{ fontSize: 11, margin: 0, color: /Cancelled|Updated/.test(msg) ? "#0F6E56" : "#A32D2D" }}>{msg}</p> : null}
      </div>
    </div>
  );
}

function ActivityRow({ color, text, when }: { color: string; text: string; when: string }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 11.5, color: "var(--foreground)" }}>{text}</span>
      {when ? <span style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--muted-foreground)" }}>{when}</span> : null}
    </div>
  );
}
