"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { NotificationRecord } from "@/lib/notifications/types";

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export function NotificationsPanel() {
  const t = useTranslations("sharedCmp");
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const response = await fetch("/api/notifications?limit=100");
    const body = (await response.json().catch(() => null)) as {
      notifications?: NotificationRecord[];
      unreadCount?: number;
      error?: string;
    } | null;

    setLoading(false);

    if (!response.ok) {
      setError(body?.error ?? "Unable to load notifications.");
      return;
    }

    setNotifications(body?.notifications ?? []);
    setUnreadCount(body?.unreadCount ?? 0);
  }, []);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- initial notifications load on mount */
    void load();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [load]);

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

  if (loading) {
    return <p className="text-sm text-slate-500">{t("loading_notifications")}</p>;
  }

  if (error) {
    return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {unreadCount > 0 ? (
            <>
              <span className="font-semibold text-slate-900">{unreadCount}</span> unread
            </>
          ) : (
            "All caught up"
          )}
        </p>
        {unreadCount > 0 ? (
          <button
            type="button"
            className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
            onClick={() => void markAllRead()}
          >
            Mark all read
          </button>
        ) : null}
      </div>

      {notifications.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
          No notifications yet. Activity alerts will appear here as your workspace updates.
        </p>
      ) : (
        <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
          {notifications.map((notification) => (
            <article
              key={notification.id}
              className={`px-5 py-4 ${notification.is_read ? "opacity-75" : "bg-indigo-50/20"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">{notification.title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{notification.message}</p>
                  <p className="mt-2 text-xs text-slate-400">{formatDate(notification.created_at)}</p>
                </div>
                {!notification.is_read ? (
                  <button
                    type="button"
                    className="rounded-full bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white"
                    onClick={() => void markRead(notification.id)}
                  >
                    Mark read
                  </button>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase text-slate-500">
                    Read
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
