"use client";

import { useEffect, useState } from "react";

export type MilestoneKey =
  | "first_contact_added"
  | "first_document_uploaded"
  | "readiness_80"
  | "deal_room_answer"
  | "outreach_sent"
  | "profile_complete";

const MILESTONE_LABELS: Record<MilestoneKey, { title: string; subtitle: string; emoji: string }> = {
  first_contact_added:     { emoji: "🎯", title: "First investor added!",       subtitle: "Your CRM is live. Keep building your list." },
  first_document_uploaded: { emoji: "📄", title: "First document uploaded!",    subtitle: "Your data room is taking shape." },
  readiness_80:            { emoji: "⭐", title: "80% readiness score!",        subtitle: "You're in the top tier of founders on the platform." },
  deal_room_answer:        { emoji: "💬", title: "First deal room answer!",     subtitle: "Investors can see your responses. Keep going." },
  outreach_sent:           { emoji: "🚀", title: "First outreach sent!",        subtitle: "You're officially in the market. Track responses carefully." },
  profile_complete:        { emoji: "✅", title: "Company profile complete!",   subtitle: "Your listing is investor-ready." },
};

const STORAGE_KEY = "capitalos_milestones_shown";

function getShown(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function markShown(key: MilestoneKey) {
  try {
    const shown = getShown();
    shown.add(key);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...shown]));
  } catch { /* ignore */ }
}

type Props = {
  /** Pass the milestone keys that have been achieved */
  achieved: MilestoneKey[];
};

export function MilestoneCelebration({ achieved }: Props) {
  const [current, setCurrent] = useState<MilestoneKey | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const shown = getShown();
    const next = achieved.find((k) => !shown.has(k)) ?? null;
    if (next) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrent(next);
      markShown(next);
      // Small delay so it feels intentional
      const t = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(t);
    }
  }, [achieved]);

  function dismiss() {
    setVisible(false);
    setTimeout(() => setCurrent(null), 300);
  }

  if (!current || !visible) return null;

  const { emoji, title, subtitle } = MILESTONE_LABELS[current];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={dismiss}
        style={{
          position: "fixed", inset: 0, zIndex: 9998,
          background: "rgba(0,0,0,0.15)",
          animation: "celebFadeIn 0.25s ease both",
        }}
      />

      {/* Toast */}
      <div style={{
        position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)",
        zIndex: 9999,
        background: "white",
        borderRadius: 16,
        padding: "20px 24px",
        boxShadow: "0 20px 60px rgba(83,74,183,0.20), 0 4px 20px rgba(0,0,0,0.10)",
        border: "1px solid #c7d2fe",
        width: "min(400px, calc(100vw - 32px))",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center",
        animation: "celebSlideUp 0.35s cubic-bezier(0.34,1.56,0.64,1) both",
      }}>
        <style>{`
          @keyframes celebFadeIn { from { opacity: 0 } to { opacity: 1 } }
          @keyframes celebSlideUp { from { opacity: 0; transform: translateX(-50%) translateY(20px) } to { opacity: 1; transform: translateX(-50%) translateY(0) } }
          @keyframes celebPop { 0%,100% { transform: scale(1) } 50% { transform: scale(1.2) } }
        `}</style>

        {/* Confetti dots */}
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: 16, pointerEvents: "none" }}>
          {["#534AB7","#818cf8","#fbbf24","#34d399","#f472b6"].map((color, i) => (
            <div key={i} style={{
              position: "absolute",
              width: 6, height: 6, borderRadius: "50%",
              background: color,
              top: `${15 + i * 12}%`,
              left: `${5 + i * 18}%`,
              opacity: 0.6,
            }} />
          ))}
        </div>

        <span style={{ fontSize: 40, animation: "celebPop 0.6s ease both 0.2s", display: "block" }}>{emoji}</span>
        <p style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>{title}</p>
        <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>{subtitle}</p>

        <button
          type="button"
          onClick={dismiss}
          style={{
            marginTop: 4,
            padding: "8px 20px", borderRadius: 99,
            background: "#534AB7", color: "white",
            fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
          }}
        >
          Keep going 🙌
        </button>
      </div>
    </>
  );
}
