"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";

export interface EventCardData {
  id: string;
  slug: string;
  title: string;
  format: string;
  status: string;
  summary: string | null;
  dateRange: string;
  month: string | null;
  day: string | null;
  coverUrl: string | null;
  coverFocal: string;
  coverOverlay: number;
  isPast: boolean;
}

/** Filter tabs plus the card grid for the public /events page. */
export function EventsList({ events }: { events: EventCardData[] }) {
  const formats = useMemo(
    () => Array.from(new Set(events.filter((e) => !e.isPast).map((e) => e.format))),
    [events],
  );
  const hasPast = events.some((e) => e.isPast);
  const [tab, setTab] = useState<string>("all");

  const shown = events.filter((e) => {
    if (tab === "past") return e.isPast;
    if (e.isPast) return false;
    return tab === "all" || e.format === tab;
  });

  const tabs: { key: string; label: string }[] = [
    { key: "all", label: "All" },
    ...formats.map((f) => ({ key: f, label: f.replace("_", " ") })),
    ...(hasPast ? [{ key: "past", label: "Past events" }] : []),
  ];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-2xl font-bold tracking-tight text-[var(--navy)]">
          {tab === "past" ? "Past events" : "Upcoming events"}
        </h2>
        {tabs.length > 2 ? (
          <div className="flex flex-wrap gap-2" role="tablist">
            {tabs.map((x) => (
              <button
                key={x.key}
                type="button"
                role="tab"
                aria-selected={tab === x.key}
                onClick={() => setTab(x.key)}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold capitalize transition ${
                  tab === x.key
                    ? "border-[var(--navy)] bg-[var(--navy)] text-white"
                    : "border-[var(--border-subtle)] bg-white text-[var(--text-secondary)] hover:border-[var(--indigo)]"
                }`}
              >
                {x.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {shown.length === 0 ? (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-white px-6 py-16 text-center md:col-span-2">
            <CalendarDays className="mx-auto h-8 w-8 text-[var(--text-muted)]" />
            <p className="mt-3 text-sm font-medium text-[var(--text-primary)]">Nothing in this view yet</p>
          </div>
        ) : (
          shown.map((ev) => (
            <Link
              key={ev.id}
              href={`/events/${ev.slug}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-white shadow-[var(--shadow-panel)] transition hover:-translate-y-0.5 hover:border-[var(--indigo)]"
            >
              <div className="relative h-44 w-full overflow-hidden bg-[var(--navy)]">
                {ev.coverUrl ? (
                  <>
                    <div
                      aria-hidden
                      className="absolute inset-0"
                      style={{ backgroundImage: `url(${ev.coverUrl})`, backgroundSize: "cover", backgroundPosition: ev.coverFocal }}
                    />
                    <div aria-hidden className="absolute inset-0" style={{ background: "#0c2340", opacity: ev.coverOverlay / 100 }} />
                  </>
                ) : null}
                {ev.month && ev.day ? (
                  <div className="absolute left-3.5 top-3.5 rounded-xl bg-white px-3 py-1.5 text-center leading-tight text-[var(--navy)] shadow">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--indigo)]">{ev.month}</div>
                    <div className="text-xl font-bold">{ev.day}</div>
                  </div>
                ) : null}
              </div>
              <div className="flex flex-1 flex-col gap-2.5 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[var(--indigo-soft)] px-2.5 py-0.5 text-xs font-medium capitalize text-[var(--indigo)]">
                    {ev.format.replace("_", " ")}
                  </span>
                  {ev.status === "live" && (
                    <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700">Live</span>
                  )}
                </div>
                <h3 className="text-lg font-semibold text-[var(--navy)]">{ev.title}</h3>
                <p className="text-sm text-[var(--text-muted)]">{ev.dateRange}</p>
                {ev.summary && <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{ev.summary}</p>}
                <div className="mt-auto flex items-center justify-between border-t border-[var(--border-subtle)] pt-3 text-sm font-semibold text-[var(--indigo)]">
                  <span>{ev.isPast ? "View event" : ev.status === "live" ? "Join now" : "Register"}</span>
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </>
  );
}
