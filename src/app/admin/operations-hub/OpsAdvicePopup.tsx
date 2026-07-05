"use client";

// Proactive advice popup — surfaces the top hub-wide suggestion (SLA stalls,
// diligence backlog) as a dismissable floating card. Never auto-acts. Dismissals
// persist for the browser session so it nudges without nagging.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Advice = { id: string; title: string; message: string; actions: { label: string; href: string; primary?: boolean }[] };
const KEY = "ops_advice_dismissed";

function dismissedIds(): Set<string> {
  try { return new Set(JSON.parse(sessionStorage.getItem(KEY) ?? "[]")); } catch { return new Set(); }
}

export function OpsAdvicePopup() {
  const [items, setItems] = useState<Advice[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/operations/advice");
      if (!res.ok) return;
      const data = await res.json();
      const dismissed = dismissedIds();
      setItems(((data.suggestions ?? []) as Advice[]).filter((s) => !dismissed.has(s.id)));
    } catch { /* ignore */ }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch suggestions on mount
  useEffect(() => { void load(); }, [load]);

  const current = items[0];
  if (!current) return null;

  function dismiss() {
    try {
      const d = dismissedIds();
      d.add(current.id);
      sessionStorage.setItem(KEY, JSON.stringify([...d]));
    } catch { /* ignore */ }
    setItems((prev) => prev.slice(1));
  }

  return (
    <div style={{ position: "fixed", right: 24, bottom: 24, width: 340, background: "#fff", border: "0.5px solid #BFDBFE", borderLeft: "3px solid #2E78F5", borderRadius: 12, boxShadow: "0 8px 28px rgb(12 35 64 / 0.16)", padding: "14px 16px", zIndex: 300 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#2E78F5", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>AI</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#1A4E9E" }}>💡 {current.title}</span>
        <button onClick={dismiss} aria-label="Dismiss" style={{ marginLeft: "auto", fontSize: 15, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer", lineHeight: 1 }}>×</button>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--foreground)", lineHeight: 1.55 }}>{current.message}</div>
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        {current.actions.map((a) => (
          <Link key={a.href + a.label} href={a.href}
            style={{ fontSize: 11.5, fontWeight: 600, textDecoration: "none", borderRadius: 7, padding: "7px 13px",
              color: a.primary ? "#fff" : "var(--muted-foreground)", background: a.primary ? "#2E78F5" : "#fff", border: a.primary ? "none" : "0.5px solid var(--border-strong, #cbd5e1)" }}>
            {a.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
