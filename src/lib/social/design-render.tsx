import { ImageResponse } from "next/og";
import { DESIGN_SIZES, DESIGN_STYLES, type DesignSize, type DesignStyle } from "@/lib/social/design-config";
import type { DesignSpec } from "@/lib/social/design-spec";

export type DesignLayout = "left" | "center";
export type DesignGraphic = "circles" | "blocks" | "none";

/** Font and padding per canvas, so text stays large and readable on a phone. */
const SCALE: Record<DesignSize, { head: number; sub: number; btn: number; pad: number }> = {
  banner: { head: 64, sub: 28, btn: 24, pad: 70 },
  portrait: { head: 92, sub: 40, btn: 34, pad: 80 },
  square: { head: 84, sub: 36, btn: 32, pad: 80 },
};

/** Draw a design to a PNG. Uses the font bundled with next/og, so no server fonts are needed. */
export async function renderDesign(spec: DesignSpec, style: DesignStyle, size: DesignSize, layout: DesignLayout, graphic: DesignGraphic): Promise<Buffer> {
  const { w, h } = DESIGN_SIZES[size];
  const c = DESIGN_STYLES[style].colors;
  const s = SCALE[size];
  const center = layout === "center";
  const wide = size === "banner";
  const statOnSide = Boolean(spec.stat) && wide && !center;

  const el = (
    <div style={{ width: w, height: h, display: "flex", position: "relative", background: `linear-gradient(135deg, ${c.bg1}, ${c.bg2})`, color: c.text, overflow: "hidden" }}>
      {graphic === "circles" ? (
        <div style={{ display: "flex", position: "absolute", right: -h * 0.15, top: -h * 0.2, width: h * 0.9, height: h * 0.9, borderRadius: h, border: `${Math.round(h * 0.05)}px solid ${c.accent}`, opacity: 0.25 }} />
      ) : null}
      {graphic === "blocks" ? (
        <div style={{ display: "flex", position: "absolute", right: -h * 0.12, bottom: -h * 0.12, width: h * 0.6, height: h * 0.6, borderRadius: 40, background: c.accent, opacity: 0.2, transform: "rotate(18deg)" }} />
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: center ? "center" : "flex-start", textAlign: center ? "center" : "left", padding: s.pad, width: statOnSide ? "62%" : "100%" }}>
        <div style={{ display: "flex", fontSize: s.head, fontWeight: 800, lineHeight: 1.12, letterSpacing: -1 }}>{spec.headline}</div>
        {spec.subline ? <div style={{ display: "flex", marginTop: 22, fontSize: s.sub, lineHeight: 1.3, opacity: 0.88 }}>{spec.subline}</div> : null}
        {spec.stat && !statOnSide ? (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 30, alignItems: center ? "center" : "flex-start" }}>
            <div style={{ display: "flex", fontSize: s.head * 1.4, fontWeight: 800, color: c.accent, lineHeight: 1 }}>{spec.stat.value}</div>
            {spec.stat.label ? <div style={{ display: "flex", fontSize: s.sub, opacity: 0.88 }}>{spec.stat.label}</div> : null}
          </div>
        ) : null}
        {spec.button ? (
          <div style={{ display: "flex", marginTop: 36, padding: `${s.btn * 0.5}px ${s.btn * 1.2}px`, borderRadius: 999, background: c.accent, color: c.btnText, fontSize: s.btn, fontWeight: 700 }}>{spec.button}</div>
        ) : null}
      </div>
      {statOnSide && spec.stat ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "38%", padding: 40 }}>
          <div style={{ display: "flex", fontSize: 130, fontWeight: 800, color: c.accent, lineHeight: 1 }}>{spec.stat.value}</div>
          {spec.stat.label ? <div style={{ display: "flex", marginTop: 12, fontSize: 28, textAlign: "center", opacity: 0.9 }}>{spec.stat.label}</div> : null}
        </div>
      ) : null}
    </div>
  );
  const res = new ImageResponse(el, { width: w, height: h });
  return Buffer.from(await res.arrayBuffer());
}
