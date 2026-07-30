"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Archive, Trash2 } from "lucide-react";
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
  const [selected, setSelected] = useState<Set<string>>(new Set());

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

  const allIds = notifications.map((n) => n.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));

  function toggle(id: string) {
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allIds));
  }

  async function bulk(action: "read" | "archive" | "delete", ids: string[]) {
    if (ids.length === 0) return;
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ids }),
    });
    const removedUnread = notifications.filter((r) => ids.includes(r.id) && !r.is_read).length;
    if (action === "read") {
      setNotifications((cur) => cur.map((r) => (ids.includes(r.id) ? { ...r, is_read: true } : r)));
    } else {
      setNotifications((cur) => cur.filter((r) => !ids.includes(r.id)));
    }
    setUnreadCount((c) => Math.max(0, c - removedUnread));
    setSelected((s) => { const n = new Set(s); ids.forEach((id) => n.delete(id)); return n; });
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
        <div className="flex items-center gap-3">
          {notifications.length > 0 ? (
            <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" className="h-4 w-4" />
          ) : null}
          {selected.size > 0 ? (
            <span className="text-sm font-semibold text-indigo-700">{selected.size} selected</span>
          ) : (
            <p className="text-sm text-slate-600">
              {unreadCount > 0 ? (<><span className="font-semibold text-slate-900">{unreadCount}</span> unread</>) : "All caught up"}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 ? (
            <>
              <button type="button" onClick={() => void bulk("read", [...selected])} className="rounded-full border border-slate-300 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Mark read</button>
              <button type="button" onClick={() => void bulk("archive", [...selected])} className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"><Archive className="h-3.5 w-3.5" /> Archive</button>
              <button type="button" onClick={() => void bulk("delete", [...selected])} className="inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-red-50 px-3.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
            </>
          ) : unreadCount > 0 ? (
            <button type="button" className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700" onClick={() => void markAllRead()}>Mark all read</button>
          ) : null}
        </div>
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
              className={`flex items-start gap-3 px-5 py-4 ${selected.has(notification.id) ? "bg-indigo-50/40" : notification.is_read ? "opacity-75" : "bg-indigo-50/20"}`}
            >
              <input
                type="checkbox"
                checked={selected.has(notification.id)}
                onChange={() => toggle(notification.id)}
                aria-label={`Select ${notification.title}`}
                className="mt-1 h-4 w-4 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-950">{notification.title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{notification.message}</p>
                <p className="mt-2 text-xs text-slate-400">{formatDate(notification.created_at)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {!notification.is_read ? (
                  <button
                    type="button"
                    className="rounded-full bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white"
                    onClick={() => void markRead(notification.id)}
                  >
                    Mark read
                  </button>
                ) : null}
                <button type="button" aria-label="Archive" title="Archive" onClick={() => void bulk("archive", [notification.id])} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-amber-700">
                  <Archive className="h-4 w-4" />
                </button>
                <button type="button" aria-label="Delete" title="Delete" onClick={() => void bulk("delete", [notification.id])} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
