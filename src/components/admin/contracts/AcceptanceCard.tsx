"use client";

// Manager acceptance for a sent subscription package: where it stands, and the Accept action.
// Acceptance records the decision and emails the subscriber to follow the Subscription Instructions.
// It does not hold, receive or move funds.

import { useCallback, useEffect, useState } from "react";
import type { AcceptanceStep } from "@/lib/contracts/subscription/acceptance";
import { api, BLUE, btn, MUTED, NAVY, Notice } from "./ui";

type View = { steps: AcceptanceStep[]; current: number; canAccept: boolean; blocker: string | null; acceptedAt: string | null; recipientEmail: string | null };

export function AcceptanceCard({ docId, onChanged }: { docId: string; onChanged?: () => void }) {
  const [view, setView] = useState<View | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "error" | "warn"; text: string } | null>(null);
  const [key, setKey] = useState(0);
  const reload = useCallback(() => setKey((k) => k + 1), []);

  useEffect(() => {
    let alive = true;
    void api<{ acceptance: View | null }>(`/api/admin/sales/contracts/${docId}/accept`).then((r) => {
      if (alive && r.ok) setView(r.data.acceptance);
    });
    return () => {
      alive = false;
    };
  }, [docId, key]);

  if (!view) return null;

  async function accept() {
    if (!window.confirm(`Accept this subscription? ${view?.recipientEmail ?? "The subscriber"} is emailed to follow the Subscription Instructions. No funds move on iCapOS.`)) return;
    setBusy(true);
    const r = await api<{ emailed?: boolean }>(`/api/admin/sales/contracts/${docId}/accept`, { method: "POST" });
    setBusy(false);
    if (!r.ok) return setMsg({ tone: "error", text: r.data.error ?? "Could not record the acceptance." });
    setMsg(r.data.emailed === false ? { tone: "warn", text: "Accepted and recorded, but the email did not go out. Tell the subscriber to follow the Subscription Instructions." } : { tone: "ok", text: "Accepted. The subscriber was emailed the next step." });
    reload();
    onChanged?.();
  }

  return (
    <div style={{ border: "1px solid #d5deea", borderRadius: 12, background: "#fff", padding: "14px 16px", marginTop: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "#8a93a6", marginBottom: 8 }}>Subscription acceptance</div>
      {view.steps.map((s, i) => (
        <div key={s.key} style={{ display: "grid", gridTemplateColumns: "22px minmax(0,1fr)", gap: 8, padding: "6px 0", alignItems: "start" }}>
          <span aria-hidden="true" style={{ width: 20, height: 20, borderRadius: 10, background: s.done ? "#1a7f43" : i === view.current ? BLUE : "#e3e9f2", color: "#fff", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            {s.done ? "✓" : i + 1}
          </span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>{s.label}</div>
            <div style={{ fontSize: 11.5, color: MUTED }}>{s.detail}</div>
          </div>
        </div>
      ))}
      {view.blocker ? <div style={{ fontSize: 11.5, color: "#8a6500", marginTop: 6 }}>{view.blocker}</div> : null}
      {msg ? <div style={{ marginTop: 8 }}><Notice tone={msg.tone}>{msg.text}</Notice></div> : null}
      {!view.acceptedAt ? (
        <div style={{ marginTop: 10, textAlign: "right" }}>
          <button type="button" disabled={busy || !view.canAccept} onClick={() => void accept()} style={{ ...btn(true), opacity: busy || !view.canAccept ? 0.5 : 1 }}>
            {busy ? "Recording…" : "Accept subscription"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
