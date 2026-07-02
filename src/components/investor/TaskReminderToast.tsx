"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Task } from "@/lib/tasks/types";

/* ---------- date helpers ---------- */

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function isToday(iso: string): boolean {
  const today = startOfDay(new Date());
  const taskDay = startOfDay(new Date(iso));
  return taskDay === today;
}

function isTomorrow(iso: string): boolean {
  const tomorrow = startOfDay(new Date()) + 86_400_000;
  const taskDay = startOfDay(new Date(iso));
  return taskDay === tomorrow;
}

/* ---------- component ---------- */

export function TaskReminderToast() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible] = useState(false);

  /* Fetch on mount */
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/tasks");
        if (!res.ok) return;
        const data: Task[] = await res.json();
        const urgent = data.filter(
          (t) =>
            t.status !== "done" &&
            t.status !== "cancelled" &&
            t.due_date !== null &&
            (isToday(t.due_date) || isTomorrow(t.due_date)),
        );
        if (urgent.length > 0) {
          setTasks(urgent);
          // Slight delay so the page settles before the toast slides up
          setTimeout(() => setVisible(true), 1200);
        }
      } catch {
        // silent — toast is non-critical
      }
    }
    void load();
  }, []);

  /* Auto-dismiss after 9s */
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setDismissed(true), 9000);
    return () => clearTimeout(t);
  }, [visible]);

  if (!visible || dismissed || tasks.length === 0) return null;

  const todayTasks = tasks.filter((t) => t.due_date && isToday(t.due_date));
  const tomorrowTasks = tasks.filter((t) => t.due_date && isTomorrow(t.due_date));

  const isUrgent = todayTasks.length > 0;
  const featured = todayTasks[0] ?? tomorrowTasks[0];

  const parts: string[] = [];
  if (todayTasks.length > 0)
    parts.push(`${todayTasks.length} task${todayTasks.length > 1 ? "s" : ""} due today`);
  if (tomorrowTasks.length > 0)
    parts.push(`${tomorrowTasks.length} due tomorrow`);
  const summary = parts.join(" · ");

  const accentColor = isUrgent ? "#D94F4F" : "#D97706";
  const bgLight = isUrgent ? "#FEF2F2" : "#FFFBEB";
  const textColor = isUrgent ? "#991B1B" : "#92400E";

  return (
    <div
      style={{
        position: "fixed",
        bottom: 28,
        right: 24,
        zIndex: 9999,
        width: 332,
        background: "#ffffff",
        border: `1px solid ${accentColor}30`,
        borderRadius: 14,
        boxShadow: "0 10px 32px rgba(12,35,64,.14)",
        overflow: "hidden",
        animation: "taskToastIn .32s cubic-bezier(.22,.8,.3,1) both",
      }}
      role="alert"
      aria-live="polite"
    >
      {/* Animation keyframes injected once */}
      <style>{`
        @keyframes taskToastIn {
          from { transform: translateY(20px); opacity: 0; }
          to   { transform: translateY(0);   opacity: 1; }
        }
        @keyframes taskToastShrink {
          from { width: 100%; }
          to   { width: 0%;   }
        }
      `}</style>

      {/* Top accent stripe */}
      <div style={{ height: 3, background: accentColor }} />

      {/* Body */}
      <div style={{ padding: "12px 14px 10px", display: "flex", alignItems: "flex-start", gap: 10 }}>
        {/* Icon bubble */}
        <div
          style={{
            flexShrink: 0,
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: bgLight,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke={accentColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: textColor, letterSpacing: ".01em" }}>
            {summary}
          </div>
          <div
            style={{
              fontSize: 12.5,
              color: "#1e293b",
              fontWeight: 500,
              marginTop: 2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {featured.title}
            {tasks.length > 1 ? (
              <span style={{ color: "#64748b", fontWeight: 400 }}> +{tasks.length - 1} more</span>
            ) : null}
          </div>
          <Link
            href="/investor/tasks"
            style={{
              display: "inline-block",
              marginTop: 6,
              fontSize: 11.5,
              fontWeight: 600,
              color: "#2E78F5",
              textDecoration: "none",
            }}
          >
            Open tasks →
          </Link>
        </div>

        {/* Dismiss button */}
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss reminder"
          style={{
            flexShrink: 0,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#94a3b8",
            padding: "2px 4px",
            fontSize: 14,
            lineHeight: 1,
            borderRadius: 4,
          }}
        >
          ✕
        </button>
      </div>

      {/* Auto-dismiss progress bar */}
      <div style={{ height: 2.5, background: "#f1f5f9" }}>
        <div
          style={{
            height: "100%",
            background: accentColor,
            animation: "taskToastShrink 9s linear forwards",
          }}
        />
      </div>
    </div>
  );
}
