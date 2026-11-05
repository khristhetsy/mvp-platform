"use client";

import { useEffect, useState } from "react";
import { MARKET_ZONES, clockAngles, formatClock, zoneTime } from "@/lib/ui/world-clock";

/**
 * Wall clocks for the offices and markets the Private Market touches. Real local
 * time, not sample data. Rendered empty until mounted so the server and client
 * markup agree.
 */
export function MarketClocks() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, []);

  return (
    <section
      aria-label="Market clocks"
      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-[var(--shadow-card)]"
    >
      <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-slate-500">Market clocks</p>
      {MARKET_ZONES.map((z) => {
        const t = now ? zoneTime(now, z.timeZone) : null;
        const a = t ? clockAngles(t.hour, t.minute) : null;
        const text = t ? formatClock(t.hour, t.minute) : "--:--";
        return (
          <div key={z.timeZone} className="flex items-center gap-3">
            <svg width="44" height="44" viewBox="0 0 100 100" role="img" aria-label={`${z.label} ${text}`}>
              <circle cx="50" cy="50" r="46" fill="var(--blue-muted)" stroke="var(--blue)" strokeWidth="4" />
              {[0, 90, 180, 270].map((deg) => (
                <line key={deg} x1="50" y1="8" x2="50" y2="16" stroke="#64748b" strokeWidth="3" transform={`rotate(${deg} 50 50)`} />
              ))}
              {a ? (
                <>
                  <line x1="50" y1="50" x2="50" y2="26" stroke="var(--navy)" strokeWidth="5" strokeLinecap="round" transform={`rotate(${a.hourDeg} 50 50)`} />
                  <line x1="50" y1="50" x2="50" y2="14" stroke="var(--blue)" strokeWidth="3" strokeLinecap="round" transform={`rotate(${a.minuteDeg} 50 50)`} />
                </>
              ) : null}
              <circle cx="50" cy="50" r="3.5" fill="var(--blue)" />
            </svg>
            <div>
              <div className="font-mono text-[17px] font-semibold leading-none text-[var(--navy)]">{text}</div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">{z.label}</div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
