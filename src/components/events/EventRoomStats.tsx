"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { EventCountdown } from "@/components/events/EventCountdown";

type Props = {
  investors: number;
  founders: number;
  registered: number;
  matchable: number;
  matches: number;
  /** Omitted when the organiser turned the countdown off, or there is no date. */
  startsAt?: string | null;
};

const RING = 2 * Math.PI * 31;

/** A filled arc needs a denominator; without one it would be a decoration. */
function Ring({ value, of, color }: Readonly<{ value: number; of: number | null; color: string }>) {
  const label = value.toLocaleString();
  const small = label.length > 3;
  return (
    <svg viewBox="0 0 72 72" className="mx-auto h-16 w-16" aria-hidden="true">
      {of && of > 0 ? (
        <>
          <circle cx="36" cy="36" r="31" fill="none" strokeWidth="4" style={{ stroke: "var(--border-subtle)" }} />
          <circle
            cx="36" cy="36" r="31" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
            strokeDasharray={`${Math.min(value / of, 1) * RING} ${RING}`}
            transform="rotate(-90 36 36)"
          />
        </>
      ) : (
        // No ceiling, so no arc: a dashed ring says "this number only grows"
        // rather than implying a proportion of something.
        <circle cx="36" cy="36" r="31" fill="none" stroke={color} strokeWidth="4" strokeDasharray="3 6" />
      )}
      <text
        x="36" y="41" textAnchor="middle"
        style={{ fontSize: small ? 16 : 19, fill: "var(--navy)", fontWeight: 600 }}
      >
        {label}
      </text>
    </svg>
  );
}

function Stat({ value, of, color, label, note }: Readonly<{
  value: number; of: number | null; color: string; label: string; note: string;
}>) {
  return (
    <div className="text-center">
      <Ring value={value} of={of} color={color} />
      <div className="mt-0.5 text-xs text-[var(--navy)]">{label}</div>
      <div className="text-[11px] text-[var(--text-muted)]">{note}</div>
    </div>
  );
}

/** Rendered after mount, so the visitor's own clock is the one quoted. */
function AsAt() {
  const [at, setAt] = useState<string | null>(null);
  useEffect(() => {
    // Deferred a tick: the server has no idea what time it is where the
    // visitor is, so this can only be filled in after mount.
    const id = setTimeout(
      () => setAt(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })),
      0,
    );
    return () => clearTimeout(id);
  }, []);
  if (!at) return null;
  return <span className="text-[11.5px] text-[var(--text-muted)]">{at}</span>;
}

/**
 * How full the room is, and how many introductions are in it.
 *
 * Counted from registrations on every load — the page is dynamic, so a
 * registration from five minutes ago is already here. Matches use the same
 * rule as the staff board, which is why both live in `matching-rule.ts`.
 */
export function EventRoomStats({
  investors, founders, registered, matchable, matches, startsAt,
}: Readonly<Props>) {
  const t = useTranslations("appPages");

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-white p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-[13.5px] text-[var(--navy)]">{t("room_stats_title")}</span>
        <AsAt />
      </div>

      <div className="grid grid-cols-4 gap-3">
        <Stat
          value={investors} of={registered} color="#378ADD"
          label={t("room_stats_investors")} note={t("room_stats_of", { total: registered })}
        />
        <Stat
          value={founders} of={registered} color="#7F77DD"
          label={t("room_stats_founders")} note={t("room_stats_of", { total: registered })}
        />
        <Stat
          value={registered} of={null} color="#F0997B"
          label={t("room_stats_registered")} note={t("room_stats_matchable", { count: matchable })}
        />
        <Stat
          value={matches} of={null} color="#1D9E75"
          label={t("room_stats_matches")} note={t("room_stats_basis")}
        />
      </div>

      {startsAt ? <EventCountdown startsAt={startsAt} bare /> : null}
    </div>
  );
}
