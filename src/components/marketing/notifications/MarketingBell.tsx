"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

type FeedItem = {
  id: string; type_id: string; title: string; body: string;
  link: string | null; read_at: string | null; created_at: string;
};

const PURPLE = "#534AB7";

function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function MarketingBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/marketing/notifications/feed?limit=20");
      if (!res.ok) return;
      const d = await res.json();
      setItems(d.items ?? []);
      setUnread(d.unreadCount ?? 0);
    } catch { /* best-effort */ }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const id = setInterval(() => void load(), 60_000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const markRead = async (opts: { id?: string; all?: boolean }) => {
    try {
      await fetch("/api/admin/marketing/notifications/read", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(opts),
      });
      await load();
    } catch { /* best-effort */ }
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button" onClick={() => setOpen((v) => !v)} aria-label="Notifications"
        style={{ position: "relative", width: 30, height: 30, borderRadius: 7, border: "0.5px solid var(--border)", background: "var(--background)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5f5e5a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 ? (
          <span style={{ position: "absolute", top: -5, right: -5, minWidth: 16, height: 16, padding: "0 4px", borderRadius: 999, background: "#A32D2D", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div style={{ position: "absolute", right: 0, top: 38, width: 340, maxHeight: 440, overflowY: "auto", background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, boxShadow: "0 8px 24px rgb(12 35 64 / 0.14)", zIndex: 50 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "0.5px solid #eef1f5", position: "sticky", top: 0, background: "#fff" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#0f2147" }}>Notifications</span>
            {unread > 0 ? (
              <button type="button" onClick={() => void markRead({ all: true })} style={{ fontSize: 11.5, color: PURPLE, background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>
                Mark all read
              </button>
            ) : null}
          </div>
          {items.length === 0 ? (
            <p style={{ fontSize: 12.5, color: "#7a8494", padding: 20, textAlign: "center" }}>You&apos;re all caught up.</p>
          ) : items.map((it) => {
            const inner = (
              <div style={{ display: "flex", gap: 10, padding: "10px 14px", borderBottom: "0.5px solid #f2f4f7", background: it.read_at ? "#fff" : "#f7f6fe", cursor: it.link ? "pointer" : "default" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: it.read_at ? "transparent" : PURPLE, marginTop: 6, flexShrink: 0 }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 500, color: "#0f2147" }}>{it.title}</span>
                    <span style={{ fontSize: 10.5, color: "#9aa3b0", flexShrink: 0 }}>{timeAgo(it.created_at)}</span>
                  </div>
                  <p style={{ fontSize: 11.5, color: "#6b7280", margin: "2px 0 0", lineHeight: 1.4 }}>{it.body}</p>
                </div>
              </div>
            );
            return it.link ? (
              <Link key={it.id} href={it.link} onClick={() => void markRead({ id: it.id })} style={{ textDecoration: "none" }}>{inner}</Link>
            ) : (
              <button key={it.id} type="button" onClick={() => void markRead({ id: it.id })} style={{ display: "block", width: "100%", textAlign: "left", border: "none", background: "none", padding: 0, cursor: "pointer" }}>{inner}</button>
            );
          })}
          <Link href="/admin/marketing/settings/notifications" onClick={() => setOpen(false)} style={{ display: "block", textAlign: "center", padding: "10px 14px", fontSize: 12, color: PURPLE, textDecoration: "none", fontWeight: 500, position: "sticky", bottom: 0, background: "#fff", borderTop: "0.5px solid #eef1f5" }}>
            Notification settings
          </Link>
        </div>
      ) : null}
    </div>
  );
}
