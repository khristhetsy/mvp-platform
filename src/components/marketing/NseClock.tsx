"use client";

import { useEffect, useState } from "react";

/** New York date and time for the board. Rendered as dashes until mounted so server and client markup agree. */
export function NseClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  const tz = { timeZone: "America/New_York" };
  const date = now
    ? new Intl.DateTimeFormat("en-GB", { ...tz, day: "2-digit", month: "short", year: "numeric" }).format(now).toUpperCase()
    : "--";
  const time = now
    ? new Intl.DateTimeFormat("en-US", { ...tz, hour: "numeric", minute: "2-digit", second: "2-digit" }).format(now)
    : "--";
  return (
    <div className="flex flex-col justify-center font-mono leading-snug text-[var(--navy)]" aria-label="New York time">
      <span className="text-[15px] font-semibold">{date}</span>
      <span className="text-[17px] font-semibold">{time}</span>
      <span className="text-[10px] uppercase tracking-[0.12em] text-slate-500">New York</span>
    </div>
  );
}
