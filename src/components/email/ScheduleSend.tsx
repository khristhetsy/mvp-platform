"use client";

/**
 * Schedule send, the shared picker. Every staff send button gets a small
 * arrow beside it (ScheduleSendMenu); the arrow opens tomorrow morning,
 * tomorrow afternoon, Monday morning and a custom date and time, all Pacific
 * time. The main button still sends at once. After scheduling, the send point
 * shows ScheduledNotice (time, Change, Cancel). Sends happen through
 * /api/cron/scheduled-emails; Sales › Scheduled emails lists them all.
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Clock } from "lucide-react";
import { formatSendAt, sendPresets, validSendAt } from "@/lib/scheduled-emails/time";
import { PICKER_WIDTH as PANEL_W, pickerPosition } from "@/lib/scheduled-emails/picker-position";
import { fromPlatformInput, toPlatformInput } from "@/lib/time/platform-input";

const NAVY = "#0A1A40";
const BLUE = "#1A6CE4";
const MUTED = "#5a6b87";

export type ScheduledInfo = { id: string; sendAt: string };

/** Posts a send request with scheduleAt. Returns the stored row, or an error message. */
export async function postScheduled(url: string, body: Record<string, unknown>, sendAt: string): Promise<ScheduledInfo | { error: string }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, scheduleAt: sendAt }) });
    const data = (await res.json().catch(() => ({}))) as { id?: string; sendAt?: string; error?: string };
    if (!res.ok || !data.id || !data.sendAt) return { error: data.error ?? "Couldn't schedule the email." };
    return { id: data.id, sendAt: data.sendAt };
  } catch {
    return { error: "Couldn't schedule the email." };
  }
}

async function patchScheduled(id: string, body: Record<string, unknown>): Promise<string | null> {
  try {
    const res = await fetch(`/api/admin/scheduled-emails/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return data.error ?? "That didn't work. Try again.";
  } catch {
    return "That didn't work. Try again.";
  }
}

function defaultCustom(): string {
  return toPlatformInput(sendPresets()[0].iso);
}

/**
 * The popover body: presets plus a PT date and time. Rendered into the page
 * body with fixed positioning beside its anchor, so a card or panel that clips
 * its contents (overflow: hidden) can never cut it off.
 */
function PickerPanel({ anchor, title, actionLabel, onPick, onClose, placement = "below" }: { anchor: RefObject<HTMLElement | null>; title: string; actionLabel: string; onPick: (iso: string) => Promise<string | null>; onClose: () => void; placement?: "below" | "above" }) {
  const [custom, setCustom] = useState(defaultCustom);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const presets = sendPresets();

  async function pick(iso: string) {
    const invalid = validSendAt(iso);
    if (invalid) return setError(invalid);
    setBusy(true);
    setError(null);
    const err = await onPick(iso);
    setBusy(false);
    if (err) setError(err);
    else onClose();
  }

  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useLayoutEffect(() => {
    const place = () => {
      const a = anchor.current?.getBoundingClientRect();
      if (!a) return;
      const h = panelRef.current?.offsetHeight ?? 330;
      setPos(pickerPosition(a, h, { width: window.innerWidth, height: window.innerHeight }, placement));
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [anchor, placement, error]);

  const date = custom.slice(0, 10);
  const time = custom.slice(11, 16);
  return createPortal(
    <div ref={panelRef} data-schedule-picker="" role="dialog" aria-label={title} style={{ position: "fixed", top: pos?.top ?? -9999, left: pos?.left ?? -9999, visibility: pos ? "visible" : "hidden", zIndex: 1000, width: PANEL_W, background: "#fff", border: "0.5px solid #d5deea", borderRadius: 12, boxShadow: "0 8px 24px rgba(10,26,64,.12)", padding: 8, textAlign: "left" }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: MUTED, padding: "4px 8px 6px" }}>{title}</div>
      {presets.map((p) => (
        <button key={p.label} type="button" disabled={busy} onClick={() => void pick(p.iso)} style={{ display: "flex", width: "100%", justifyContent: "space-between", gap: 8, border: "none", background: "none", borderRadius: 6, padding: "7px 8px", fontSize: 12.5, color: NAVY, cursor: "pointer" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#f3f6fb"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}>
          <span>{p.label}</span>
          <span style={{ color: MUTED }}>{formatSendAt(p.iso).replace(/ PT$/, "")}</span>
        </button>
      ))}
      <div style={{ borderTop: "0.5px solid #eef1f5", margin: "6px 0 0", padding: "8px 8px 2px" }}>
        <div style={{ fontSize: 12, color: NAVY, marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}><Clock size={13} aria-hidden="true" /> Pick date and time</div>
        <div style={{ display: "flex", gap: 6 }}>
          <input type="date" aria-label="Send date" value={date} onChange={(e) => { setError(null); setCustom(`${e.target.value}T${time || "08:00"}`); }} style={{ flex: 1, minWidth: 0, height: 32, border: "0.5px solid #d5deea", borderRadius: 7, padding: "0 8px", fontSize: 12, color: NAVY }} />
          <input type="time" aria-label="Send time" value={time} onChange={(e) => { setError(null); setCustom(`${date}T${e.target.value}`); }} style={{ width: 116, height: 32, border: "0.5px solid #d5deea", borderRadius: 7, padding: "0 8px", fontSize: 12, color: NAVY }} />
        </div>
        {error ? <div role="alert" style={{ fontSize: 11.5, color: "#A32D2D", marginTop: 6 }}>{error}</div> : null}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
          <span style={{ fontSize: 11, color: "#8a93a6" }}>Pacific time</span>
          <button type="button" disabled={busy} onClick={() => { const at = fromPlatformInput(custom); if (!at) { setError("Pick a date and time first."); return; } void pick(at.toISOString()); }}
            style={{ border: "none", background: BLUE, color: "#fff", borderRadius: 7, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
            {busy ? "Scheduling…" : actionLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function useOutsideClose(open: boolean, close: () => void) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Element | null;
      // The picker is portaled to the page body: a click inside it is not "outside".
      if (t?.closest?.("[data-schedule-picker]")) return;
      if (ref.current && !ref.current.contains(t as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open, close]);
  return ref;
}

/**
 * The arrow beside a send button. Style it to match its button with
 * chevronStyle or chevronClassName. onSchedule returns an error message, or
 * null when the email was scheduled.
 */
export function ScheduleSendMenu({ onSchedule, disabled, title = "Schedule send", chevronStyle, chevronClassName, ariaLabel, placement = "below" }: {
  onSchedule: (sendAt: string) => Promise<string | null>;
  disabled?: boolean;
  title?: string;
  chevronStyle?: CSSProperties;
  chevronClassName?: string;
  ariaLabel?: string;
  /** "above" for buttons at the bottom of a modal or panel, so the picker isn't cut off. */
  placement?: "below" | "above";
}) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  return (
    <span ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      <button type="button" disabled={disabled} aria-haspopup="dialog" aria-expanded={open} aria-label={ariaLabel ?? title} title={title}
        onClick={() => setOpen((o) => !o)} className={chevronClassName} style={chevronStyle}>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open ? <PickerPanel anchor={ref} title={title} actionLabel="Schedule" onPick={onSchedule} onClose={() => setOpen(false)} placement={placement} /> : null}
    </span>
  );
}

/** "Scheduled for Fri Oct 9, 8:00 AM PT · Change · Cancel", under the send buttons. */
export function ScheduledNotice({ info, onChange, onCanceled, align = "right", style }: {
  info: ScheduledInfo;
  onChange: (next: ScheduledInfo) => void;
  onCanceled: () => void;
  align?: "left" | "right";
  style?: CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useOutsideClose(open, () => setOpen(false));
  const link: CSSProperties = { border: "none", background: "none", padding: 0, color: BLUE, cursor: "pointer", fontSize: "inherit", fontWeight: 600 };
  return (
    <div style={{ fontSize: 12, color: "#1a7f43", textAlign: align, margin: "6px 0 0", ...style }}>
      <span ref={ref} style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: align === "right" ? "flex-end" : "flex-start" }}>
        <Clock size={13} aria-hidden="true" /> Scheduled for {formatSendAt(info.sendAt)}
        <span aria-hidden="true">·</span>
        <button type="button" style={link} onClick={() => setOpen((o) => !o)}>Change</button>
        <span aria-hidden="true">·</span>
        <button type="button" style={link} onClick={async () => { const err = await patchScheduled(info.id, { action: "cancel" }); if (err) setError(err); else onCanceled(); }}>Cancel</button>
        {open ? (
          <PickerPanel anchor={ref} title="Change send time" actionLabel="Save time" onClose={() => setOpen(false)}
            onPick={async (iso) => { const err = await patchScheduled(info.id, { action: "reschedule", sendAt: iso }); if (!err) onChange({ id: info.id, sendAt: iso }); return err; }} />
        ) : null}
      </span>
      {error ? <div role="alert" style={{ color: "#A32D2D", marginTop: 4 }}>{error}</div> : null}
    </div>
  );
}

/** A "Change" link that opens the picker and moves a scheduled email to a new time. */
export function RescheduleButton({ id, onChanged, style, label = "Change" }: { id: string; onChanged: (sendAt: string) => void; style?: CSSProperties; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  return (
    <span ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      <button type="button" style={style} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{label}</button>
      {open ? (
        <PickerPanel anchor={ref} title="Change send time" actionLabel="Save time" onClose={() => setOpen(false)}
          onPick={async (iso) => { const err = await patchScheduled(id, { action: "reschedule", sendAt: iso }); if (!err) onChanged(iso); return err; }} />
      ) : null}
    </span>
  );
}

type PendingRow = { id: string; to_label: string; subject: string; send_at: string; status: string; error: string | null };

/**
 * Pending scheduled sends for one record (a contract contact, an Investor
 * Relations match), with Send now and Cancel. Renders nothing when there are none.
 */
export function PendingScheduledList({ kind, contextKey, refreshKey, title = "Scheduled" }: { kind: string; contextKey: string; refreshKey?: number; title?: string }) {
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    void fetch(`/api/admin/scheduled-emails?status=scheduled&kind=${encodeURIComponent(kind)}&contextKey=${encodeURIComponent(contextKey)}`)
      .then((r) => (r.ok ? r.json() : { rows: [] }))
      .then((d: { rows?: PendingRow[] }) => { if (live) setRows(d.rows ?? []); })
      .catch(() => undefined);
    return () => { live = false; };
  }, [kind, contextKey, refreshKey, tick]);

  if (!rows.length) return null;
  async function act(id: string, action: "send_now" | "cancel") {
    setBusy(id);
    setError(null);
    const err = await patchScheduled(id, { action });
    setBusy(null);
    if (err) setError(err);
    setTick((t) => t + 1);
  }
  const link: CSSProperties = { border: "none", background: "none", padding: 0, color: BLUE, cursor: "pointer", fontSize: 11.5, fontWeight: 600, marginLeft: 10 };
  return (
    <div style={{ border: "0.5px solid #e3e8f0", borderRadius: 10, background: "#fff", marginBottom: 10, overflow: "hidden" }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "#8a93a6", padding: "10px 14px 4px" }}>{title}</div>
      {rows.map((r) => (
        <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", borderTop: "0.5px solid #eef1f5", fontSize: 12.5, color: NAVY, flexWrap: "wrap" }}>
          <span style={{ flex: "1 1 220px", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.subject || "(no subject)"}</span>
          <span style={{ color: MUTED }}>{formatSendAt(r.send_at)}</span>
          <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: "#FAEEDA", color: "#854F0B" }}>{r.status === "sending" ? "Sending" : "Scheduled"}</span>
          {r.status === "scheduled" ? (
            <span>
              <button type="button" disabled={busy === r.id} style={link} onClick={() => void act(r.id, "send_now")}>{busy === r.id ? "Sending…" : "Send now"}</button>
              <button type="button" disabled={busy === r.id} style={link} onClick={() => void act(r.id, "cancel")}>Cancel</button>
            </span>
          ) : null}
        </div>
      ))}
      {error ? <div role="alert" style={{ fontSize: 11.5, color: "#A32D2D", padding: "0 14px 10px" }}>{error}</div> : null}
    </div>
  );
}
