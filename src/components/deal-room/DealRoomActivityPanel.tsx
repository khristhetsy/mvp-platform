"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { EnrichedActivityEvent } from "@/app/api/deal-room/[roomId]/activity/route";

// ── Time helpers ──────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function groupByDay(events: EnrichedActivityEvent[]): { label: string; events: EnrichedActivityEvent[] }[] {
  const map = new Map<string, EnrichedActivityEvent[]>();
  for (const e of events) {
    const key = new Date(e.created_at).toDateString();
    const arr = map.get(key) ?? [];
    arr.push(e);
    map.set(key, arr);
  }
  return [...map.entries()].map(([_key, evs]) => ({
    label: dayLabel(evs[0]!.created_at),
    events: evs,
  }));
}

// ── Event metadata ────────────────────────────────────────────────────────────

type EventConfig = { label: string; bg: string; color: string; icon: React.ReactElement };

function eventIcon(stroke: string) {
  return { stroke };
}

const CONFIGS: Record<string, EventConfig> = {
  room_created: {
    label: "Room created",
    bg: "#EEEDFE", color: "#2E78F5",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2E78F5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  room_viewed: {
    label: "Room viewed by investor",
    bg: "#eff6ff", color: "#1d4ed8",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  room_status_changed: {
    label: "Room status changed",
    bg: "#fef9c3", color: "#854d0e",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#854d0e" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
        <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
      </svg>
    ),
  },
  question_created: {
    label: "Question submitted",
    bg: "#fef3c7", color: "#92400e",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  founder_responded: {
    label: "Response posted",
    bg: "#f0fdf4", color: "#15803d",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
  question_resolved: {
    label: "Question resolved",
    bg: "#f0fdf4", color: "#15803d",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="10" /><polyline points="9 12 11 14 15 10" />
      </svg>
    ),
  },
  doc_requested: {
    label: "Document requested",
    bg: "#fef3c7", color: "#92400e",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" />
      </svg>
    ),
  },
  doc_fulfilled: {
    label: "Document provided",
    bg: "#f0fdf4", color: "#15803d",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
        <polyline points="9 14 11 16 15 12" />
      </svg>
    ),
  },
  follow_up_requested: {
    label: "Follow-up requested",
    bg: "#fef2f2", color: "#b91c1c",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
};

function getConfig(type: string): EventConfig {
  return CONFIGS[type] ?? {
    label: type.replaceAll("_", " "),
    bg: "#f1f5f9", color: "#475569",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="4" />
      </svg>
    ),
  };
}

// ── Actor label ───────────────────────────────────────────────────────────────

function actorLabel(event: EnrichedActivityEvent): string {
  if (!event.actor_user_id) return "";
  if (event.actor_role === "founder") return event.actor_name ?? "You";
  if (event.actor_role === "investor") return event.actor_name ?? "Investor";
  if (event.actor_role === "admin") return "Platform";
  return event.actor_name ?? "User";
}

function metaDetail(event: EnrichedActivityEvent): string | null {
  const m = event.metadata;
  if (!m) return null;
  if (event.event_type === "question_created" && m.category) return `Category: ${String(m.category)}`;
  if (event.event_type === "doc_requested" && m.request_type) return `Type: ${String(m.request_type).replaceAll("_", " ")}`;
  if (event.event_type === "room_status_changed" && m.new_status) return `→ ${String(m.new_status)}`;
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DealRoomActivityPanel({ roomId }: { roomId: string }) {
  const t = useTranslations("sharedCmp");
  const [events, setEvents] = useState<EnrichedActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/deal-room/${roomId}/activity`);
    if (res.ok) {
      const body = await res.json() as { events: EnrichedActivityEvent[] };
      setEvents(body.events ?? []);
      setLastUpdated(new Date());
    }
    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const interval = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(interval);
  }, [load]);

  const groups = groupByDay(events);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: "#EEEDFE" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2E78F5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <h2 className="text-sm font-semibold text-slate-900">{t("activity_feed")}</h2>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated ? (
            <span className="text-[11px] text-slate-400">
              Updated {relTime(lastUpdated.toISOString())}
            </span>
          ) : null}
          <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-600">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            Live
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="animate-spin text-indigo-500" aria-label="Loading">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={1.75} aria-hidden>
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-600">{t("no_activity_yet")}</p>
            <p className="mt-1 text-xs text-slate-400">{t("activity_will_appear_here_when_investors_eng")}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.label}>
                {/* Date label */}
                <div className="mb-3 flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-100" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">{group.label}</span>
                  <div className="h-px flex-1 bg-slate-100" />
                </div>

                {/* Events */}
                <div className="relative space-y-0">
                  {group.events.map((event, i) => {
                    const config = getConfig(event.event_type);
                    const actor = actorLabel(event);
                    const detail = metaDetail(event);
                    const isLast = i === group.events.length - 1;

                    return (
                      <div key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
                        {/* Vertical connector */}
                        {!isLast && (
                          <div className="absolute left-[13px] top-7 bottom-0 w-px bg-slate-100" />
                        )}

                        {/* Icon */}
                        <div
                          className="relative z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                          style={{ background: config.bg }}
                        >
                          {config.icon}
                        </div>

                        {/* Content */}
                        <div className="min-w-0 flex-1 pt-0.5">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                            <p className="text-sm font-semibold text-slate-900">{config.label}</p>
                            <span className="text-[11px] text-slate-400">{relTime(event.created_at)}</span>
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2">
                            {actor ? (
                              <span className="text-xs text-slate-500">
                                <span className="font-medium text-slate-700">{actor}</span>
                                {event.actor_role === "investor" && (
                                  <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">{t("investor")}</span>
                                )}
                                {event.actor_role === "founder" && (
                                  <span className="ml-1.5 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600">{t("you")}</span>
                                )}
                              </span>
                            ) : null}
                            {detail ? (
                              <span className="text-[11px] text-slate-400">{detail}</span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {events.length > 0 ? (
        <div className="border-t border-slate-100 px-5 py-3">
          <p className="text-[11px] text-slate-400">{events.length} event{events.length !== 1 ? "s" : ""} · refreshes every 30s</p>
        </div>
      ) : null}
    </div>
  );
}
