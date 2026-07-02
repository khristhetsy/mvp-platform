"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

function parts(targetMs: number, nowMs: number) {
  let diff = targetMs - nowMs;
  if (diff < 0) diff = 0;
  return {
    d: Math.floor(diff / 86_400_000),
    h: Math.floor((diff % 86_400_000) / 3_600_000),
    m: Math.floor((diff % 3_600_000) / 60_000),
    s: Math.floor((diff % 60_000) / 1000),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Live countdown to the event start. Renders nothing once the start has passed. */
export function EventCountdown({ startsAt }: { startsAt: string }) {
  const t = useTranslations("appPages");
  const target = new Date(startsAt).getTime();
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (Number.isNaN(target) || target <= now) return null;
  const { d, h, m, s } = parts(target, now);

  const cells: { value: string; label: string }[] = [
    { value: String(d), label: t("countdown_days") },
    { value: pad(h), label: t("countdown_hours") },
    { value: pad(m), label: t("countdown_minutes") },
    { value: pad(s), label: t("countdown_seconds") },
  ];

  return (
    <div
      className="rounded-2xl border border-[var(--border-subtle)] bg-white p-5"
      role="timer"
      aria-label={t("countdown_days")}
    >
      <div className="grid grid-cols-4 gap-3">
        {cells.map((c) => (
          <div key={c.label} className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#F0997B] text-2xl font-semibold tabular-nums text-[var(--navy)]">
              {c.value}
            </div>
            <div className="mt-1.5 text-[11px] text-[var(--text-secondary)]">{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
