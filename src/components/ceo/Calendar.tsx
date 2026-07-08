"use client";

import { useMemo, useState } from "react";
import type { CeoMeeting, CeoOccurrence } from "@/lib/ceo/meetings";

const navy = "#0A1A40", royal = "#1A6CE4";
const DEPT_COLOR: Record<string, string> = { sales: "#1A6CE4", marketing: "#7C3AED", operations: "#0E9F6E" };
const inp: React.CSSProperties = { fontSize: 12.5, padding: "8px 10px", borderRadius: 8, border: "1px solid #E4E8F0", background: "#fff", color: navy, boxSizing: "border-box" };

async function api(url: string, method: string, body?: unknown): Promise<{ ok: boolean; data: unknown }> {
  try {
    const r = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    return { ok: r.ok, data: await r.json().catch(() => ({})) };
  } catch { return { ok: false, data: {} }; }
}

/* ── Recurrence math ── */
const EPOCH_MONDAY = Date.UTC(2024, 0, 1); // a Monday, used for biweekly parity
const DAY_MS = 86400000;

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function mondayOf(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7; // 0 = Monday
  x.setDate(x.getDate() - dow);
  return x;
}
/** Does a recurring meeting land on this date, per its cadence? */
function meetingOccursOn(meeting: CeoMeeting, date: Date): boolean {
  const jsDow = date.getDay(); // 0=Sun..6=Sat
  const meetingJs = meeting.dayOfWeek % 7; // Mon(1)->1 ... Sun(7)->0
  if (jsDow !== meetingJs) return false;
  if (meeting.cadence === "weekly") return true;
  if (meeting.cadence === "biweekly") {
    const weekIdx = Math.floor((mondayOf(date).getTime() - EPOCH_MONDAY) / (7 * DAY_MS));
    return ((weekIdx % 2) + 2) % 2 === 0;
  }
  // monthly → first matching weekday of the month
  return date.getDate() <= 7;
}

interface DayEvent { meeting: CeoMeeting; time: string; occurrenceId?: string; note?: string | null; oneOff: boolean }

function eventsForDate(date: Date, meetings: CeoMeeting[], occByDate: Map<string, CeoOccurrence[]>): DayEvent[] {
  const out: DayEvent[] = [];
  for (const m of meetings) if (meetingOccursOn(m, date)) out.push({ meeting: m, time: m.timeLocal.slice(0, 5), oneOff: false });
  for (const o of occByDate.get(ymd(date)) ?? []) {
    const m = meetings.find((x) => x.key === o.meetingKey);
    if (m) out.push({ meeting: m, time: (o.timeLocal ?? m.timeLocal).slice(0, 5), occurrenceId: o.id, note: o.note, oneOff: true });
  }
  return out.sort((a, b) => a.time.localeCompare(b.time));
}

/* ── Calendar view ── */

export function CalendarView({ meetings, occurrences, onRefresh }: { meetings: CeoMeeting[]; occurrences: CeoOccurrence[]; onRefresh: () => void }) {
  const [mode, setMode] = useState<"week" | "month">("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [adding, setAdding] = useState(false);

  const occByDate = useMemo(() => {
    const map = new Map<string, CeoOccurrence[]>();
    for (const o of occurrences) { const arr = map.get(o.occursOn) ?? []; arr.push(o); map.set(o.occursOn, arr); }
    return map;
  }, [occurrences]);

  const shift = (dir: number) => setAnchor((a) => { const x = new Date(a); x.setDate(x.getDate() + dir * (mode === "week" ? 7 : 30)); return x; });

  const seg = (opts: [string, string][], val: string, on: (v: string) => void) => (
    <div style={{ display: "inline-flex", background: "#EEF1F7", borderRadius: 8, padding: 2 }}>
      {opts.map(([k, l]) => <button key={k} onClick={() => on(k)} style={{ fontSize: 12, fontWeight: 600, padding: "5px 11px", borderRadius: 6, border: "none", cursor: "pointer", background: val === k ? "#fff" : "transparent", color: val === k ? navy : "#6B7690" }}>{l}</button>)}
    </div>
  );

  const label = mode === "week"
    ? (() => { const s = mondayOf(anchor); const e = new Date(s); e.setDate(e.getDate() + 6); return `${s.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${e.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`; })()
    : anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: navy }}>Calendar</div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 6 }}>
          <button onClick={() => shift(-1)} style={navBtn}>‹</button>
          <button onClick={() => setAnchor(new Date())} style={{ ...navBtn, width: "auto", padding: "0 10px", fontSize: 11.5, fontWeight: 600 }}>Today</button>
          <button onClick={() => shift(1)} style={navBtn}>›</button>
          <span style={{ fontSize: 13, fontWeight: 600, color: navy, marginLeft: 6 }}>{label}</span>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          {seg([["week", "Week"], ["month", "Month"]], mode, (v) => setMode(v as "week" | "month"))}
          <button onClick={() => setAdding((v) => !v)} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: navy, border: "none", borderRadius: 8, padding: "7px 13px", cursor: "pointer" }}>{adding ? "Cancel" : "+ One-off"}</button>
        </div>
      </div>

      {adding && <AddOccurrence meetings={meetings} onDone={() => { setAdding(false); onRefresh(); }} />}

      {mode === "week"
        ? <WeekGrid anchor={anchor} meetings={meetings} occByDate={occByDate} onDelete={async (id) => { await api(`/api/ceo/occurrences/${id}`, "DELETE"); onRefresh(); }} />
        : <MonthGrid anchor={anchor} meetings={meetings} occByDate={occByDate} />}

      <div style={{ display: "flex", gap: 14, marginTop: 12, flexWrap: "wrap" }}>
        {Object.entries(DEPT_COLOR).map(([d, c]) => <span key={d} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "#6B7690", textTransform: "capitalize" }}><span style={{ width: 9, height: 9, borderRadius: 2, background: c }} />{d}</span>)}
        <span style={{ fontSize: 11, color: "#6B7690" }}>Dashed = one-off</span>
      </div>
    </div>
  );
}

const navBtn: React.CSSProperties = { width: 28, height: 28, borderRadius: 7, border: "1px solid #E4E8F0", background: "#fff", color: navy, cursor: "pointer", fontSize: 15, lineHeight: 1 };

function EventChip({ ev, onDelete }: { ev: DayEvent; onDelete?: (id: string) => void }) {
  const c = DEPT_COLOR[ev.meeting.dept] ?? royal;
  return (
    <div title={ev.note ?? ev.meeting.name} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10.5, lineHeight: 1.3, padding: "3px 6px", borderRadius: 5, background: `${c}14`, color: navy, borderLeft: `3px ${ev.oneOff ? "dashed" : "solid"} ${c}` }}>
      <span style={{ fontWeight: 700, color: c }}>{ev.time}</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.meeting.name}</span>
      {ev.oneOff && ev.occurrenceId && onDelete && <button onClick={() => onDelete(ev.occurrenceId!)} style={{ marginLeft: "auto", border: "none", background: "none", color: "#98A2B3", cursor: "pointer", fontSize: 11, padding: 0 }} aria-label="Remove">✕</button>}
    </div>
  );
}

function WeekGrid({ anchor, meetings, occByDate, onDelete }: { anchor: Date; meetings: CeoMeeting[]; occByDate: Map<string, CeoOccurrence[]>; onDelete: (id: string) => void }) {
  const start = mondayOf(anchor);
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d; });
  const todayStr = ymd(new Date());
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
      {days.map((d) => {
        const evs = eventsForDate(d, meetings, occByDate);
        const isToday = ymd(d) === todayStr;
        return (
          <div key={ymd(d)} style={{ background: "#fff", border: `1px solid ${isToday ? royal : "#E4E8F0"}`, borderRadius: 10, minHeight: 130, padding: 8 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: isToday ? royal : "#6B7690", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 }}>{d.toLocaleDateString(undefined, { weekday: "short" })} {d.getDate()}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {evs.length === 0 ? <span style={{ fontSize: 10.5, color: "#C1CAD9" }}>—</span> : evs.map((ev, i) => <EventChip key={i} ev={ev} onDelete={onDelete} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MonthGrid({ anchor, meetings, occByDate }: { anchor: Date; meetings: CeoMeeting[]; occByDate: Map<string, CeoOccurrence[]> }) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = mondayOf(first);
  const cells = Array.from({ length: 42 }, (_, i) => { const d = new Date(gridStart); d.setDate(d.getDate() + i); return d; });
  const todayStr = ymd(new Date());
  const month = anchor.getMonth();
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 6 }}>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w) => <div key={w} style={{ fontSize: 10.5, fontWeight: 700, color: "#6B7690", textTransform: "uppercase", textAlign: "center", letterSpacing: ".04em" }}>{w}</div>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
        {cells.map((d) => {
          const evs = eventsForDate(d, meetings, occByDate);
          const inMonth = d.getMonth() === month;
          const isToday = ymd(d) === todayStr;
          return (
            <div key={ymd(d)} style={{ background: inMonth ? "#fff" : "#FAFBFD", border: `1px solid ${isToday ? royal : "#E9ECF3"}`, borderRadius: 8, minHeight: 92, padding: 6, opacity: inMonth ? 1 : 0.6 }}>
              <div style={{ fontSize: 10.5, fontWeight: isToday ? 700 : 600, color: isToday ? royal : "#6B7690", marginBottom: 4 }}>{d.getDate()}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {evs.slice(0, 3).map((ev, i) => <EventChip key={i} ev={ev} />)}
                {evs.length > 3 && <span style={{ fontSize: 10, color: "#6B7690" }}>+{evs.length - 3} more</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AddOccurrence({ meetings, onDone }: { meetings: CeoMeeting[]; onDone: () => void }) {
  const [meetingKey, setMeetingKey] = useState(meetings[0]?.key ?? "");
  const [date, setDate] = useState(ymd(new Date()));
  const [time, setTime] = useState("10:00");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!meetingKey) return;
    setBusy(true); setErr(null);
    const { ok, data } = await api(`/api/ceo/meetings/${meetingKey}/occurrences`, "POST", { occursOn: date, timeLocal: time, note: note || null });
    setBusy(false);
    if (ok) onDone(); else setErr((data as { error?: string }).error ?? "Failed to add.");
  }

  return (
    <div style={{ background: "#F6F8FB", borderRadius: 10, padding: 12, marginBottom: 14, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <select value={meetingKey} onChange={(e) => setMeetingKey(e.target.value)} style={inp}>{meetings.map((m) => <option key={m.key} value={m.key}>{m.name}</option>)}</select>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inp} />
      <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={inp} />
      <input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} style={{ ...inp, flex: 1, minWidth: 140 }} />
      <button onClick={save} disabled={busy || !meetingKey} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: royal, border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>{busy ? "Adding…" : "Add"}</button>
      {err && <span style={{ fontSize: 11.5, color: "#D6455D", width: "100%" }}>{err}</span>}
    </div>
  );
}
