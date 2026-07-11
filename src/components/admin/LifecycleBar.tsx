"use client";

// Reusable lifecycle funnel for hub dashboards. Renders an ordered set of stages as
// connected chevron segments, each showing its label + live count. Clicking a stage
// navigates to that stage's filtered list (href). One component, per-hub stage config.
import Link from "next/link";

export interface LifecycleStage { key: string; label: string; count: number; href?: string }

const NAVY = "#0A1A40", MUTED = "var(--muted-foreground)";

export function LifecycleBar({
  title, stages, accent = "#1A6CE4", activeKey,
}: {
  title?: string;
  stages: LifecycleStage[];
  accent?: string;
  activeKey?: string;
}) {
  if (!stages || stages.length === 0) return null;
  const max = Math.max(1, ...stages.map((s) => s.count));

  return (
    <div style={{ background: "#fff", border: "1px solid #E4E8F0", borderRadius: 12, padding: "12px 14px" }}>
      {title && <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: MUTED, marginBottom: 10 }}>{title}</div>}
      <div style={{ display: "flex", gap: 6, alignItems: "stretch", flexWrap: "wrap" }}>
        {stages.map((s, i) => {
          const active = activeKey && s.key === activeKey;
          const intensity = 0.12 + 0.5 * (s.count / max); // fuller stages read stronger
          const inner = (
            <div
              style={{
                position: "relative", flex: "1 1 0", minWidth: 96,
                background: active ? accent : hexA(accent, intensity),
                color: active ? "#fff" : NAVY,
                borderRadius: 8, padding: "8px 12px 8px 14px",
                clipPath: i === stages.length - 1 ? undefined : "polygon(0 0, calc(100% - 9px) 0, 100% 50%, calc(100% - 9px) 100%, 0 100%)",
                transition: "background .12s",
              }}
            >
              <div style={{ fontSize: 19, fontWeight: 700, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{s.count}</div>
              <div style={{ fontSize: 11, marginTop: 3, color: active ? "rgba(255,255,255,.85)" : MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</div>
            </div>
          );
          return s.href ? (
            <Link key={s.key} href={s.href} style={{ flex: "1 1 0", minWidth: 96, textDecoration: "none", display: "flex" }} aria-label={`${s.label}: ${s.count}`}>{inner}</Link>
          ) : (
            <div key={s.key} style={{ flex: "1 1 0", minWidth: 96, display: "flex" }}>{inner}</div>
          );
        })}
      </div>
    </div>
  );
}

// Blend a hex color toward white by alpha (0..1) for the lighter segment fills.
function hexA(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const a = Math.max(0, Math.min(1, alpha));
  const mix = (c: number) => Math.round(c * a + 255 * (1 - a));
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}
