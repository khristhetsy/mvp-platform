"use client";

import { useEffect, useRef, useState } from "react";

export type MoveWeekOption = { id: string; label: string; range: string };

/**
 * Three dots on a task card. Opens "Move to week" with the month's weeks; picking one moves the
 * card there. The current week is marked and can't be picked. The list is positioned on the
 * screen so the scrolling board never clips it.
 */
export function MoveWeekMenu({ title, weeks, currentId, disabled, onMove }: {
  title: string; weeks: MoveWeekOption[]; currentId: string; disabled?: boolean; onMove: (weekId: string) => void;
}) {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const open = pos !== null;

  useEffect(() => {
    if (!open) return;
    const close = () => setPos(null);
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { close(); btn.current?.focus(); } };
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => { document.removeEventListener("keydown", esc); window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [open]);

  function toggle() {
    if (open) { setPos(null); return; }
    const r = btn.current?.getBoundingClientRect();
    if (r) setPos({ top: Math.min(r.bottom + 4, window.innerHeight - 260), right: Math.max(8, window.innerWidth - r.right) });
  }

  return (
    <>
      <button ref={btn} type="button" disabled={disabled} onClick={toggle} aria-label={`Move ${title} to another week`} aria-haspopup="menu" aria-expanded={open} title="Move to week"
        className={`rounded px-1 text-[15px] text-slate-400 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-60 ${open ? "bg-indigo-50 text-indigo-700" : ""}`}>
        <i className="ti ti-dots" aria-hidden="true" />
      </button>
      {pos ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPos(null)} aria-hidden="true" />
          <div role="menu" aria-label="Move to week" style={{ top: pos.top, right: pos.right }} className="fixed z-50 w-60 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
            <div className="px-2 pb-1 pt-1.5 text-[10px] uppercase tracking-[.05em] text-slate-400">Move to week</div>
            {weeks.map((w) => {
              const here = w.id === currentId;
              return (
                <button key={w.id} type="button" role="menuitem" disabled={here} onClick={() => { setPos(null); onMove(w.id); }}
                  className={`flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] ${here ? "bg-indigo-50 text-indigo-700" : "text-slate-800 hover:bg-slate-50"}`}>
                  <span className={here ? "font-semibold" : "font-medium"}>{w.label}</span>
                  <span className="flex-1 text-[11px] text-slate-500">{w.range}</span>
                  {here ? <span className="text-[11px] font-semibold">Current</span> : null}
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </>
  );
}
