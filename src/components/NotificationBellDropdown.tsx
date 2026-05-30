"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
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

export function NotificationBellDropdown() {
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

  useEffect(() => {
    void loadNotifications();
    const interval = window.setInterval(() => void loadNotifications(), 60000);
    return () => window.clearInterval(interval);
  }, [loadNotifications]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
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

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => !value);
          if (!open) {
            void loadNotifications();
          }
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
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-950">Notifications</p>
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

          <div className="max-h-80 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500">Loading…</p>
            ) : notifications.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500">No notifications yet.</p>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  className={`block w-full border-b border-slate-50 px-4 py-3 text-left transition hover:bg-slate-50 ${
                    notification.is_read ? "opacity-70" : "bg-indigo-50/30"
                  }`}
                  onClick={() => {
                    if (!notification.is_read) {
                      void markRead(notification.id);
                    }
                  }}
                >
                  <p className="text-sm font-semibold text-slate-950">{notification.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{notification.message}</p>
                  <p className="mt-1 text-[10px] text-slate-400">{formatRelativeTime(notification.created_at)}</p>
                </button>
              ))
            )}
          </div>

          <div className="border-t border-slate-100 px-4 py-3">
            <Link
              href="/notifications"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-500"
              onClick={() => setOpen(false)}
            >
              View all notifications
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
