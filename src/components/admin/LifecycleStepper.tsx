"use client";

// Numbered-steps lifecycle card for hub dashboards. Renders each stage as a numbered
// node on a retention-tinted progress line, with count + % of funnel. Click "Expand"
// to reveal stage-to-stage drop-off, the biggest recoverable leak, and an "Ask AI"
// button that opens the iCapOS assistant (via the icapos-assistant:ask window event)
// pre-loaded with a question about that leak. One component, per-hub config.
import { useState } from "react";
import Link from "next/link";

export interface LifecycleStage { key: string; label: string; count: number; href?: string }

const NAVY = "#0A1A40", MUTED = "var(--muted-foreground)";

function tint(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const clamp = Math.max(0, Math.min(1, a));
  const m = (c: number) => Math.round(c * clamp + 255 * (1 - clamp));
  return `rgb(${m(r)}, ${m(g)}, ${m(b)})`;
}

export function LifecycleStepper({
  title = "Lifecycle", stages, accent = "#7C3AED", askLabel = "iCapOS AI",
}: {
  title?: string;
  stages: LifecycleStage[];
  accent?: string;
  askLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!stages || stages.length === 0) return null;

  const n = stages.length;
  const total = stages.reduce((a, s) => a + s.count, 0);
  const drops = stages.slice(0, -1).map((s, i) => {
    const to = stages[i + 1];
    const lost = s.count - to.count;
    return { from: s, to, lost, pct: s.count > 0 ? Math.round((lost / s.count) * 100) : 0 };
  });
  const leak = drops.slice().sort((a, b) => b.lost - a.lost)[0];

  const ask = () => {
    if (!leak) return;
    const prompt = `In the ${title.toLowerCase()}, the biggest drop-off is ${leak.from.label} → ${leak.to.label} — ${leak.lost.toLocaleString()} contacts lost (${leak.pct}%). How do I recover them? Give me a concrete next step.`;
    window.dispatchEvent(new CustomEvent("icapos-assistant:ask", { detail: { prompt } }));
  };

  return (
    <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: NAVY }}>{title}
          <span style={{ fontSize: 12, color: MUTED, fontWeight: 400 }}> · {total.toLocaleString()} in funnel</span>
        </span>
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open}
          style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: accent, background: tint(accent, 0.1), border: "none", borderRadius: 8, padding: "5px 11px", cursor: "pointer" }}>
          {open ? "Collapse" : "Expand"} <i className={`ti ti-chevron-${open ? "up" : "down"}`} aria-hidden="true" />
        </button>
      </div>

      {/* Numbered steps on a retention-tinted progress line */}
      <div style={{ position: "relative" }}>
        <div style={{ position: "absolute", top: 11, left: `${(0.5 / n) * 100}%`, right: `${(0.5 / n) * 100}%`, height: 2, background: "var(--border)" }} />
        {drops.map((d, i) => (
          <div key={d.from.key} style={{
            position: "absolute", top: 10, left: `${((i + 0.5) / n) * 100}%`, width: `${(1 / n) * 100}%`, height: 4,
            background: tint(accent, 0.25 + 0.55 * (d.to.count / Math.max(1, d.from.count))), borderRadius: 2,
          }} />
        ))}
        <div style={{ position: "relative", display: "grid", gridTemplateColumns: `repeat(${n}, 1fr)` }}>
          {stages.map((s, i) => {
            const node = (
              <>
                <span style={{ width: 24, height: 24, borderRadius: "50%", background: accent, color: "#fff", fontSize: 12, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>{i + 1}</span>
                <span style={{ display: "block", textAlign: "center", fontSize: 14, fontWeight: 500, color: NAVY, marginTop: 7 }}>{s.count.toLocaleString()}</span>
                <span style={{ display: "block", textAlign: "center", fontSize: 10.5, color: MUTED, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</span>
                <span style={{ display: "block", textAlign: "center", fontSize: 10, color: tint(accent, 0.85), marginTop: 1 }}>{total > 0 ? Math.round((s.count / total) * 100) : 0}%</span>
              </>
            );
            return s.href ? (
              <Link key={s.key} href={s.href} style={{ position: "relative", zIndex: 1, textDecoration: "none" }} aria-label={`${s.label}: ${s.count}`}>{node}</Link>
            ) : (
              <div key={s.key} style={{ position: "relative", zIndex: 1 }}>{node}</div>
            );
          })}
        </div>
      </div>

      {open && (
        <div style={{ marginTop: 16, borderTop: "0.5px solid var(--border)", paddingTop: 14 }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", color: MUTED, marginBottom: 8 }}>Stage-to-stage drop-off</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 14 }}>
            {drops.map((d) => {
              const big = d.pct >= 40;
              return (
                <div key={d.from.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, padding: "6px 10px", borderRadius: 8, background: big ? "#FCEBEB" : "#F6F8FB" }}>
                  <span style={{ color: MUTED }}>{d.from.label} → {d.to.label}</span>
                  <span style={{ color: big ? "#A32D2D" : NAVY }}>−{d.lost.toLocaleString()} ({d.pct}%)</span>
                </div>
              );
            })}
          </div>
          {leak && (
            <div style={{ background: tint(accent, 0.09), borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <i className="ti ti-sparkles" style={{ color: accent }} aria-hidden="true" />
                <span style={{ fontSize: 13, fontWeight: 500, color: accent }}>{askLabel}</span>
              </div>
              <div style={{ fontSize: 13, color: NAVY, lineHeight: 1.6, marginBottom: 10 }}>
                Biggest leak: {leak.from.label} → {leak.to.label} — {leak.lost.toLocaleString()} contacts lost ({leak.pct}%). That&rsquo;s the highest-volume recovery on the board.
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={ask} style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: accent, border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>Ask {askLabel} how to fix it</button>
                {leak.from.href && <Link href={leak.from.href} style={{ fontSize: 12, fontWeight: 500, color: accent, background: tint(accent, 0.12), borderRadius: 8, padding: "6px 12px", textDecoration: "none" }}>Open {leak.from.label} →</Link>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
