"use client";

import { computeEngagementSnapshot } from "@/lib/deal-rooms/metrics";
import { useTranslations } from "next-intl";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Question = {
  id: string;
  status: string;
  category: string;
  question: string;
  created_at: string;
  responded_at: string | null;
};

type DocRequest = {
  id: string;
  status: string;
  request_type: string;
  custom_request: string | null;
  created_at: string;
  fulfilled_at: string | null;
};

type ActivityEvent = {
  id: string;
  event_type: string;
  created_at: string;
};

type Room = {
  id: string;
  title: string;
  status: string;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getMilestoneStep(
  room: Room,
  questions: Question[],
  docRequests: DocRequest[],
  activity: ActivityEvent[],
): 1 | 2 | 3 | 4 | 5 {
  if (room.status === "closed" || room.status === "archived") return 5;

  const allQResolved =
    questions.length > 0 && questions.every((q) => q.status === "resolved");
  const allDocsOk = docRequests.every(
    (d) => d.status === "fulfilled" || d.status === "cancelled",
  );
  if (allQResolved && allDocsOk && (questions.length > 0 || docRequests.length > 0)) return 4;

  const hasEngagement =
    questions.length > 0 ||
    docRequests.length > 0 ||
    activity.some((e) => ["question_created", "doc_requested"].includes(e.event_type));
  if (hasEngagement) return 3;

  const viewed = activity.some((e) => e.event_type === "room_viewed");
  if (viewed) return 2;

  return 1;
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffHrs = Math.floor(diffMs / 3_600_000);
  if (diffHrs < 1) return "Just now";
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function daysSince(iso: string): number {
  return Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

const EVENT_META: Record<string, { label: string; icon: string; bg: string; color: string }> = {
  room_created:       { label: "Room created",                  icon: "ti-door-enter",        bg: "#EEEDFE", color: "#534AB7" },
  room_viewed:        { label: "Room viewed by investor",        icon: "ti-eye",               bg: "#EEEDFE", color: "#534AB7" },
  room_status_changed:{ label: "Room status changed",           icon: "ti-refresh",            bg: "#E6F1FB", color: "#185FA5" },
  question_created:   { label: "Question asked by investor",     icon: "ti-help",              bg: "#FAEEDA", color: "#854F0B" },
  founder_responded:  { label: "You responded to a question",    icon: "ti-message-reply",     bg: "#EAF3DE", color: "#3B6D11" },
  question_resolved:  { label: "Question resolved",              icon: "ti-check",             bg: "#EAF3DE", color: "#3B6D11" },
  doc_requested:      { label: "Document requested",             icon: "ti-file-text",         bg: "#FAEEDA", color: "#854F0B" },
  doc_fulfilled:      { label: "Document fulfilled",             icon: "ti-file-check",        bg: "#EAF3DE", color: "#3B6D11" },
  follow_up_requested:{ label: "Follow-up requested",            icon: "ti-clock-exclamation", bg: "#FCEBEB", color: "#A32D2D" },
};

function getEventMeta(type: string) {
  return (
    EVENT_META[type] ?? {
      label: type.replaceAll("_", " "),
      icon: "ti-activity",
      bg: "#F1EFE8",
      color: "#5F5E5A",
    }
  );
}

// ---------------------------------------------------------------------------
// Milestone node
// ---------------------------------------------------------------------------
function MilestoneNode({
  step,
  current,
  icon,
  label,
  sub,
}: {
  step: number;
  current: number;
  icon: string;
  label: string;
  sub: string;
}) {
  const done = step < current;
  const active = step === current;

  return (
    <div className="flex flex-1 flex-col items-center gap-1.5" style={{ minWidth: 0 }}>
      <div style={{ position: "relative" }}>
        {active ? (
          <div
            style={{
              position: "absolute",
              inset: -5,
              borderRadius: "50%",
              border: "2px solid #534AB7",
              opacity: 0.35,
            }}
          />
        ) : null}
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: done || active ? "#534AB7" : "var(--color-background-secondary, #f8f7f5)",
            border: done || active ? "none" : "1.5px solid var(--color-border-tertiary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          {done ? (
            <i className="ti ti-check" style={{ fontSize: 15, color: "white" }} aria-hidden="true" />
          ) : (
            <i
              className={`ti ${icon}`}
              style={{ fontSize: 15, color: active ? "white" : "var(--color-text-secondary)" }}
              aria-hidden="true"
            />
          )}
        </div>
      </div>
      <p
        style={{
          fontSize: 11,
          fontWeight: active || done ? 500 : 400,
          color: active || done ? "#534AB7" : "var(--color-text-secondary)",
          textAlign: "center",
          margin: 0,
          lineHeight: 1.3,
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: 10,
          color: active ? "#534AB7" : "var(--color-text-secondary)",
          textAlign: "center",
          margin: 0,
          fontWeight: active ? 500 : 400,
        }}
      >
        {sub}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function DealRoomMilestonePanel({
  room,
  questions,
  docRequests,
  activity,
}: Readonly<{
  room: Room;
  questions: Question[];
  docRequests: DocRequest[];
  activity: ActivityEvent[];
}>) {
  const t = useTranslations("sharedCmp");
  const step = getMilestoneStep(room, questions, docRequests, activity);
  const snapshot = computeEngagementSnapshot({ questions, docRequests, activity });

  const resolvedQ = questions.filter((q) => q.status === "resolved").length;
  const fulfilledDocs = docRequests.filter((d) => d.status === "fulfilled").length;
  const qPct = questions.length > 0 ? Math.round((resolvedQ / questions.length) * 100) : 0;
  const docPct = docRequests.length > 0 ? Math.round((fulfilledDocs / docRequests.length) * 100) : 0;

  // Track: 5 nodes at 10%, 30%, 50%, 70%, 90% of container (each node flex:1 = 20%)
  // Progress width (relative to container) = (step-1)/4 * 80%
  const progressW = `${((step - 1) / 4) * 80}%`;

  const STAGES: Array<{ icon: string; label: string; sub: string }> = [
    { icon: "ti-door-enter",    label: "Room created",     sub: "Day 1" },
    { icon: "ti-eye",           label: "Investor engaged", sub: step >= 2 ? "Viewed" : "Pending" },
    { icon: "ti-file-search",   label: "Under review",     sub: step === 3 ? "In progress" : step > 3 ? "Done" : "Pending" },
    { icon: "ti-circle-check",  label: "Diligence done",   sub: step === 4 ? "In progress" : step > 4 ? "Done" : "Pending" },
    { icon: "ti-lock",          label: "Closed",           sub: step === 5 ? room.status : "Pending" },
  ];

  const STAGE_LABELS = ["Room created", "Investor engaged", "Under review", "Diligence done", "Closed"];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Accent bar */}
      <div style={{ height: 3, background: "#534AB7" }} />

      <div className="p-5">
        {/* Header */}
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-slate-500">
              Diligence progress
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{room.title}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
              style={{ background: "#EEEDFE", color: "#3C3489" }}
            >
              {room.status.charAt(0).toUpperCase() + room.status.slice(1)}
            </span>
            <span className="text-[11px] text-slate-500">Day {daysSince(room.created_at)}</span>
          </div>
        </div>

        {/* Milestone track */}
        <div className="relative mb-6 flex items-start">
          {/* Base track */}
          <div
            style={{
              position: "absolute",
              top: 18,
              left: "10%",
              width: "80%",
              height: 2,
              background: "var(--color-border-tertiary, #e5e4e0)",
              zIndex: 0,
            }}
          />
          {/* Progress track */}
          <div
            style={{
              position: "absolute",
              top: 18,
              left: "10%",
              width: progressW,
              height: 2,
              background: "#534AB7",
              zIndex: 0,
            }}
          />
          {STAGES.map((s, i) => (
            <MilestoneNode
              key={s.label}
              step={i + 1}
              current={step}
              icon={s.icon}
              label={s.label}
              sub={s.sub}
            />
          ))}
        </div>

        {/* Current stage snapshot */}
        <div className="mb-4 rounded-xl p-4" style={{ background: "#EEEDFE" }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: "#534AB7",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              margin: "0 0 10px",
            }}
          >
            Currently in: {STAGE_LABELS[step - 1]}
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p style={{ fontSize: 11, color: "#7F77DD", margin: "0 0 2px" }}>{t("engagement")}</p>
              <p style={{ fontSize: 20, fontWeight: 500, color: "#3C3489", margin: 0, lineHeight: 1 }}>
                {snapshot.engagementScore}
                <span style={{ fontSize: 12, fontWeight: 400 }}> / 100</span>
              </p>
            </div>
            <div>
              <p style={{ fontSize: 11, color: "#7F77DD", margin: "0 0 2px" }}>{t("questions")}</p>
              <p style={{ fontSize: 20, fontWeight: 500, color: "#3C3489", margin: 0, lineHeight: 1 }}>
                {resolvedQ}
                <span style={{ fontSize: 12, fontWeight: 400 }}> / {questions.length}</span>
              </p>
            </div>
            <div>
              <p style={{ fontSize: 11, color: "#7F77DD", margin: "0 0 2px" }}>{t("documents")}</p>
              <p style={{ fontSize: 20, fontWeight: 500, color: "#3C3489", margin: 0, lineHeight: 1 }}>
                {fulfilledDocs}
                <span style={{ fontSize: 12, fontWeight: 400 }}> / {docRequests.length}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Progress bars */}
        {(questions.length > 0 || docRequests.length > 0) ? (
          <div className="mb-5 grid grid-cols-2 gap-4">
            {questions.length > 0 ? (
              <div>
                <div className="mb-1.5 flex justify-between">
                  <p className="text-xs text-slate-500">{t("questions_resolved")}</p>
                  <p className="text-xs font-semibold text-slate-900">{resolvedQ} / {questions.length}</p>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{ width: `${qPct}%`, background: "#534AB7" }} />
                </div>
              </div>
            ) : null}
            {docRequests.length > 0 ? (
              <div>
                <div className="mb-1.5 flex justify-between">
                  <p className="text-xs text-slate-500">{t("documents_fulfilled")}</p>
                  <p className="text-xs font-semibold text-slate-900">{fulfilledDocs} / {docRequests.length}</p>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{ width: `${docPct}%`, background: "#534AB7" }} />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Activity feed */}
        {activity.length > 0 ? (
          <>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.09em] text-slate-500">
              Recent activity
            </p>
            <div className="divide-y divide-slate-100">
              {activity.slice(0, 6).map((e) => {
                const meta = getEventMeta(e.event_type);
                return (
                  <div key={e.id} className="flex items-center gap-2.5 py-2.5">
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: meta.bg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <i className={`ti ${meta.icon}`} style={{ fontSize: 13, color: meta.color }} aria-hidden="true" />
                    </div>
                    <p className="min-w-0 flex-1 truncate text-xs text-slate-800">{meta.label}</p>
                    <p className="shrink-0 text-[11px] text-slate-400">{relativeTime(e.created_at)}</p>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <p className="text-xs text-slate-400">
            No activity yet. Share this room with an investor to get started.
          </p>
        )}
      </div>
    </div>
  );
}
