"use client";

import { useEffect, useMemo, useState } from "react";

// Pick one or more days for a post, plus one time of day. Days are YYYY-MM-DD in Pacific time.
// Used by the founder Compose tab. Past days are not selectable.

const PT = "America/Los_Angeles";
const WD = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const quick = "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50";
// Soft teal look used by Admin Compose. The Founder calendar keeps the default look above.
const tealQuick = "rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50";

const pad = (n: number) => String(n).padStart(2, "0");
const key = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

export function MultiDatePicker({ dates, onDates, time, onTime, variant = "default" }: { dates: string[]; onDates: (d: string[]) => void; time: string; onTime: (t: string) => void; variant?: "default" | "teal" }) {
  const teal = variant === "teal";
  const q = teal ? tealQuick : quick;
  // The clock is read after mount so the first render never depends on the time it runs.
  const [today, setToday] = useState<string | null>(null);
  const [view, setView] = useState<{ y: number; m: number } | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      const k = new Date().toLocaleDateString("en-CA", { timeZone: PT });
      setToday(k);
      setView({ y: Number(k.slice(0, 4)), m: Number(k.slice(5, 7)) - 1 });
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const cells = useMemo(() => {
    if (!view) return [] as (number | null)[];
    const first = new Date(Date.UTC(view.y, view.m, 1)).getUTCDay();
    const len = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
    return [...Array<null>(first).fill(null), ...Array.from({ length: len }, (_, i) => i + 1)];
  }, [view]);

  if (!view || !today) return <div className="mt-1 h-10 rounded-lg border border-slate-200 bg-slate-50" aria-hidden="true" />;

  const selectable = (d: number) => key(view.y, view.m, d) >= today;
  const monthDays = cells.filter((d): d is number => d !== null && selectable(d));
  const commit = (next: string[]) => onDates([...new Set(next)].sort());
  const toggle = (d: number) => {
    const k = key(view.y, view.m, d);
    commit(dates.includes(k) ? dates.filter((x) => x !== k) : [...dates, k]);
  };
  const move = (delta: number) => setView((v) => {
    if (!v) return v;
    const t = new Date(Date.UTC(v.y, v.m + delta, 1));
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() };
  });
  const inMonth = (k: string) => k.startsWith(`${view.y}-${pad(view.m + 1)}-`);
  const weekday = (d: number) => new Date(Date.UTC(view.y, view.m, d)).getUTCDay();

  return (
    <div className={teal ? "mt-1 rounded-2xl bg-[#faf8f5] p-3.5" : "mt-1 rounded-lg border border-slate-300 bg-white p-3"}>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" aria-label="Previous month" className={q} onClick={() => move(-1)}>‹</button>
        <span className="min-w-[8.5rem] text-center text-sm font-semibold text-slate-900">{MONTHS[view.m]} {view.y}</span>
        <button type="button" aria-label="Next month" className={q} onClick={() => move(1)}>›</button>
        <span className={`ml-auto rounded-full px-2.5 py-1 text-xs font-semibold ${teal ? "bg-teal-100 text-teal-800" : "bg-blue-50 text-blue-800"}`} aria-live="polite">
          {dates.length === 0 ? "No dates selected" : `${dates.length} date${dates.length === 1 ? "" : "s"} selected`}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-500">{WD.map((w, i) => <div key={i}>{w}</div>)}</div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={`b${i}`} />;
          const k = key(view.y, view.m, d);
          const on = dates.includes(k);
          const ok = selectable(d);
          return (
            <button key={k} type="button" disabled={!ok} aria-pressed={on} aria-label={`${MONTHS[view.m]} ${d}, ${view.y}`} onClick={() => toggle(d)}
              className={`h-9 text-sm ${teal ? "rounded-[10px]" : "rounded-lg"} ${on ? `${teal ? "bg-teal-600" : "bg-[#1A6CE4]"} font-semibold text-white` : ok ? `text-slate-900 ${teal ? "hover:bg-teal-50" : "hover:bg-blue-50"}` : "cursor-default text-slate-300"}`}>
              {d}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className={q} onClick={() => commit([...dates, ...monthDays.map((d) => key(view.y, view.m, d))])}>Select all dates</button>
        <button type="button" className={q} onClick={() => commit([...dates, ...monthDays.filter((d) => weekday(d) >= 1 && weekday(d) <= 5).map((d) => key(view.y, view.m, d))])}>Weekdays only</button>
        <button type="button" className={q} onClick={() => commit(dates.filter((k) => !inMonth(k)))}>Clear month</button>
        <button type="button" className={q} onClick={() => commit([])}>Clear all</button>
        <label className={`ml-auto flex items-center gap-2 text-xs ${teal ? "rounded-full border border-stone-200 bg-white py-1 pl-3 pr-1 text-stone-600" : "text-slate-500"}`}>Time (PT)
          <input type="time" value={time} onChange={(e) => onTime(e.target.value)} className={teal ? "rounded-full bg-stone-100 px-2 py-0.5 text-sm font-semibold text-slate-900" : "rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-900"} />
        </label>
      </div>
    </div>
  );
}
