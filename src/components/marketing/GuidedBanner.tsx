"use client";

// Dismissible "Set up your first campaign" guided flow banner for the Marketing
// dashboard. Onboarding aid only — the tabs handle real navigation. Remembers
// dismissal in localStorage so it doesn't nag returning users.

import { useEffect, useState } from "react";
import Link from "next/link";

const KEY = "mh_guided_banner_dismissed";
const STEPS = ["Prospects", "Contacts", "Campaign", "Analytics"];

export function GuidedBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try { dismissed = localStorage.getItem(KEY) === "1"; } catch { dismissed = false; }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read dismissal flag on mount
    setShow(!dismissed);
  }, []);

  if (!show) return null;

  function dismiss() {
    try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ }
    setShow(false);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", border: "0.5px solid #BFDBFE", background: "#EFF6FF", borderRadius: 12, padding: "11px 14px", marginBottom: 16 }}>
      <span style={{ fontSize: 15 }}>✨</span>
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "#1A4E9E" }}>Set up your first campaign</div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", marginTop: 3 }}>
          {STEPS.map((s, i) => (
            <span key={s} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: "#1A6CE4" }}>{s}</span>
              {i < STEPS.length - 1 ? <span style={{ color: "#93C5FD", fontSize: 10 }}>→</span> : null}
            </span>
          ))}
        </div>
      </div>
      <Link href="/admin/marketing/prospects" style={{ fontSize: 11.5, fontWeight: 700, color: "#fff", background: "#2E78F5", borderRadius: 7, padding: "7px 14px", textDecoration: "none" }}>Start →</Link>
      <button onClick={dismiss} aria-label="Dismiss" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15, color: "#1A6CE4", lineHeight: 1 }}>✕</button>
    </div>
  );
}
