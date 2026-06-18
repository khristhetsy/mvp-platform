import type { DealRoomActivityType } from "@/lib/deal-rooms/types";

export type ActivityEvent = {
  id: string;
  room_id: string;
  room_title: string;
  event_type: DealRoomActivityType;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

const EVENT_LABELS: Record<DealRoomActivityType, { label: string; icon: string; color: string }> = {
  room_created:       { label: "Room created",         icon: "🏗️",  color: "#EEEDFE" },
  room_viewed:        { label: "Room viewed",           icon: "👁️",  color: "#f0fdf4" },
  room_status_changed:{ label: "Status changed",        icon: "🔄",  color: "#fef9c3" },
  question_created:   { label: "Question submitted",    icon: "💬",  color: "#fef3c7" },
  founder_responded:  { label: "You responded",         icon: "✅",  color: "#dcfce7" },
  question_resolved:  { label: "Question resolved",     icon: "🎯",  color: "#dcfce7" },
  doc_requested:      { label: "Document requested",    icon: "📋",  color: "#fef3c7" },
  doc_fulfilled:      { label: "Document fulfilled",    icon: "📄",  color: "#dcfce7" },
  follow_up_requested:{ label: "Follow-up requested",   icon: "📩",  color: "#ede9fe" },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function DealRoomActivityFeed({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) {
    return (
      <div style={{ padding: "24px 0", textAlign: "center" }}>
        <p style={{ fontSize: 13, color: "#9ca3af" }}>No deal room activity yet.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {events.map((ev, i) => {
        const meta = EVENT_LABELS[ev.event_type] ?? {
          label: ev.event_type.replace(/_/g, " "),
          icon: "•",
          color: "#f3f4f6",
        };
        const isLast = i === events.length - 1;
        return (
          <div key={ev.id} style={{ display: "flex", gap: 12, position: "relative" }}>
            {/* Vertical line */}
            {!isLast && (
              <div style={{
                position: "absolute", left: 16, top: 36, bottom: 0,
                width: 1, background: "#f3f4f6",
              }} />
            )}

            {/* Icon bubble */}
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: meta.color, flexShrink: 0, zIndex: 1,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14,
            }}>
              {meta.icon}
            </div>

            {/* Content */}
            <div style={{ flex: 1, paddingBottom: isLast ? 0 : 20 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", margin: 0 }}>
                  {meta.label}
                </p>
                <span style={{ fontSize: 11, color: "#9ca3af", flexShrink: 0 }}>
                  {timeAgo(ev.created_at)}
                </span>
              </div>
              <p style={{ fontSize: 11, color: "#6b7280", margin: "2px 0 0" }}>
                {ev.room_title}
                {ev.metadata?.question_text
                  ? ` — "${String(ev.metadata.question_text).slice(0, 60)}…"`
                  : ""}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
