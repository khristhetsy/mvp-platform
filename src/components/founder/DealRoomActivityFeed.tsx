import type { DealRoomActivityType } from "@/lib/deal-rooms/types";
import { useTranslations } from "next-intl";

export type ActivityEvent = {
  id: string;
  room_id: string;
  room_title: string;
  event_type: DealRoomActivityType;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

// SVG icons — no emojis
type EventMeta = { label: string; icon: React.ReactElement; color: string };

function mkIcon(path: React.ReactElement, color: string) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {path}
    </svg>
  );
}

const EVENT_CONFIGS: Record<DealRoomActivityType, EventMeta> = {
  room_created: {
    label: "Room created",
    color: "#EEEDFE",
    icon: mkIcon(<><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>, "#2E78F5"),
  },
  room_viewed: {
    label: "Room viewed",
    color: "#eff6ff",
    icon: mkIcon(<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>, "#1d4ed8"),
  },
  room_status_changed: {
    label: "Status changed",
    color: "#fef9c3",
    icon: mkIcon(<><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></>, "#854d0e"),
  },
  question_created: {
    label: "Question submitted",
    color: "#fef3c7",
    icon: mkIcon(<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />, "#92400e"),
  },
  founder_responded: {
    label: "You responded",
    color: "#f0fdf4",
    icon: mkIcon(<polyline points="20 6 9 17 4 12" />, "#15803d"),
  },
  question_resolved: {
    label: "Question resolved",
    color: "#f0fdf4",
    icon: mkIcon(<><circle cx="12" cy="12" r="10" /><polyline points="9 12 11 14 15 10" /></>, "#15803d"),
  },
  doc_requested: {
    label: "Document requested",
    color: "#fef3c7",
    icon: mkIcon(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" /></>, "#92400e"),
  },
  doc_fulfilled: {
    label: "Document provided",
    color: "#f0fdf4",
    icon: mkIcon(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><polyline points="9 14 11 16 15 12" /></>, "#15803d"),
  },
  follow_up_requested: {
    label: "Follow-up requested",
    color: "#fef2f2",
    icon: mkIcon(<><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>, "#b91c1c"),
  },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function DealRoomActivityFeed({ events }: { events: ActivityEvent[] }) {
  const t = useTranslations("founderCmp");
  if (events.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm text-slate-400">{t("no_activity_yet_across_your_deal_rooms")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {events.map((ev, i) => {
        const config = EVENT_CONFIGS[ev.event_type] ?? {
          label: ev.event_type.replace(/_/g, " "),
          color: "#f3f4f6",
          icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2} aria-hidden><circle cx="12" cy="12" r="4" /></svg>,
        };
        const isLast = i === events.length - 1;

        return (
          <div key={ev.id} className="relative flex gap-3">
            {!isLast && (
              <div className="absolute left-4 top-9 bottom-0 w-px bg-slate-100" />
            )}

            <div
              className="relative z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              style={{ background: config.color }}
            >
              {config.icon}
            </div>

            <div className={`min-w-0 flex-1 ${isLast ? "pb-0" : "pb-4"}`}>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{config.label}</p>
                <span className="shrink-0 text-[11px] text-slate-400">{timeAgo(ev.created_at)}</span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {ev.room_title}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
