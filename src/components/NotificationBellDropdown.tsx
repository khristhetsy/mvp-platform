"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { NotificationRecord } from "@/lib/notifications/types";

function formatRelativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Type-based icon + color ────────────────────────────────────────────────────

type IconConfig = { path: React.ReactElement; bg: string; color: string };

function iconForType(type: string): IconConfig {
  // Deal room
  if (type.startsWith("deal_room")) {
    return {
      bg: "#EEEDFE",
      color: "#2E78F5",
      path: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      ),
    };
  }
  // Messages / threads
  if (type.includes("message")) {
    return {
      bg: "#eff6ff",
      color: "#1d4ed8",
      path: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
    };
  }
  // Meetings
  if (type.includes("meeting")) {
    return {
      bg: "#f0fdf4",
      color: "#16a34a",
      path: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      ),
    };
  }
  // Investor interest, pledge, intro
  if (type.includes("investor_expressed") || type.includes("pledge") || type.includes("intro")) {
    return {
      bg: "#fefce8",
      color: "#854d0e",
      path: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ),
    };
  }
  // Learning
  if (type.includes("learning")) {
    return {
      bg: "#f0fdf4",
      color: "#15803d",
      path: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      ),
    };
  }
  // Billing / trial
  if (type.includes("trial") || type.includes("billing") || type.includes("upgrade")) {
    return {
      bg: "#fff7ed",
      color: "#c2410c",
      path: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
        </svg>
      ),
    };
  }
  // Company / approval
  if (type.includes("company") || type.includes("approved") || type.includes("rejected")) {
    return {
      bg: "#f1f5f9",
      color: "#475569",
      path: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <line x1="3" y1="22" x2="21" y2="22" /><rect x="2" y="11" width="20" height="11" rx="2" /><path d="M12 2L2 7h20L12 2z" />
        </svg>
      ),
    };
  }
  // Default
  return {
    bg: "#f1f5f9",
    color: "#64748b",
    path: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M15 17H9c0 1.657 1.343 3 3 3s3-1.343 3-3ZM18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
      </svg>
    ),
  };
}

export function NotificationBellDropdown() {
  const t = useTranslations("sharedCmp");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/notifications?limit=12");
    const body = (await response.json().catch(() => null)) as {
      notifications?: NotificationRecord[];
      unreadCount?: number;
    } | null;

    setLoading(false);

    if (response.ok && body) {
      setNotifications(body.notifications ?? []);
      setUnreadCount(body.unreadCount ?? 0);
    }
  }, []);

  // Initial load + Supabase Realtime (replaces 60s polling)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadNotifications();

    const supabase = createClient();
    let mounted = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let channelToCleanup: any = null;

    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!mounted || !user) return;

      channelToCleanup = supabase
        .channel(`notifications_bell_${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `recipient_user_id=eq.${user.id}`,
          },
          (payload) => {
            const incoming = payload.new as NotificationRecord;
            setNotifications((prev) => [incoming, ...prev].slice(0, 12));
            setUnreadCount((n) => n + 1);
          },
        )
        .subscribe();
    });

    return () => {
      mounted = false;
      if (channelToCleanup) {
        void supabase.removeChannel(channelToCleanup as Parameters<typeof supabase.removeChannel>[0]);
      }
    };
  }, [loadNotifications]);

  // Close on outside click / Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleEscape);
      };
    }
  }, [open]);

  async function markRead(notificationId: string) {
    await fetch(`/api/notifications/${notificationId}`, { method: "PATCH" });
    setNotifications((current) =>
      current.map((row) => (row.id === notificationId ? { ...row, is_read: true } : row)),
    );
    setUnreadCount((count) => Math.max(0, count - 1));
  }

  async function markAllRead() {
    await fetch("/api/notifications", { method: "POST" });
    setNotifications((current) => current.map((row) => ({ ...row, is_read: true })));
    setUnreadCount(0);
  }

  function handleNotificationClick(notification: NotificationRecord) {
    if (!notification.is_read) void markRead(notification.id);
    setOpen(false);
    if (notification.deep_link) router.push(notification.deep_link);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls="notification-dropdown-panel"
        onClick={() => {
          setOpen((value) => !value);
          if (!open) void loadNotifications();
        }}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-indigo-200 hover:bg-white hover:text-indigo-700"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M15 17H9c0 1.657 1.343 3 3 3s3-1.343 3-3ZM18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
        {unreadCount > 0 ? (
          <span
            className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-bold text-white"
            aria-hidden
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          id="notification-dropdown-panel"
          role="region"
          aria-label="Notifications"
          className="absolute right-0 z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-950">
              Notifications
              {unreadCount > 0 ? (
                <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-100 px-1.5 text-[10px] font-bold text-violet-700">
                  {unreadCount}
                </span>
              ) : null}
            </p>
            {unreadCount > 0 ? (
              <button
                type="button"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-500"
                onClick={() => void markAllRead()}
              >
                Mark all read
              </button>
            ) : null}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500" role="status" aria-live="polite">
                Loading…
              </p>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={1.75} aria-hidden>
                    <path d="M15 17H9c0 1.657 1.343 3 3 3s3-1.343 3-3ZM18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-slate-700">{t("all_caught_up")}</p>
                <p className="mt-1 text-xs text-slate-400">{t("activity_alerts_will_appear_here")}</p>
              </div>
            ) : (
              notifications.map((notification) => {
                const icon = iconForType(notification.type);
                return (
                  <button
                    key={notification.id}
                    type="button"
                    aria-label={`${notification.title}. ${notification.is_read ? "Read" : "Unread"}${notification.deep_link ? " — click to open" : ""}`}
                    className={`flex w-full items-start gap-3 border-b border-slate-50 px-4 py-3 text-left transition hover:bg-slate-50 ${
                      notification.is_read ? "opacity-70" : "bg-indigo-50/30"
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    {/* Icon bubble */}
                    <div
                      style={{ background: icon.bg, color: icon.color, flexShrink: 0 }}
                      className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full"
                    >
                      {icon.path}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold leading-snug text-slate-950">{notification.title}</p>
                        {!notification.is_read ? (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-violet-500" aria-hidden />
                        ) : null}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-500">{notification.message}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <p className="text-[10px] text-slate-400">{formatRelativeTime(notification.created_at)}</p>
                        {notification.deep_link ? (
                          <span className="text-[10px] font-medium text-indigo-500">{t("view_2")}</span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 px-4 py-3">
            <Link
              href="/notifications"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-500"
              onClick={() => setOpen(false)}
            >
              View all notifications →
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
