import type { ReactElement } from "react";

/**
 * Shared 1200×630 brand OG template for marketing routes (spec §16). Matches the
 * root opengraph-image: navy #04143D field, #0056F4 accent, muted #9DB2D9 sub.
 * Satori-safe (every multi-child node sets display:flex; system sans only).
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

export function BrandOg({ eyebrow, title, tagline }: { eyebrow: string; title: string; tagline: string }): ReactElement {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "80px",
        background: "#04143D",
        color: "#ffffff",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: 15,
            background: "#0056F4",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 34,
            fontWeight: 700,
          }}
        >
          C
        </div>
        <div style={{ display: "flex", fontSize: 42, fontWeight: 700 }}>iCapOS</div>
      </div>
      <div style={{ display: "flex", marginTop: 40, fontSize: 22, fontWeight: 600, letterSpacing: 3, textTransform: "uppercase", color: "#6E9BF0" }}>{eyebrow}</div>
      <div style={{ display: "flex", marginTop: 18, fontSize: 64, fontWeight: 700, lineHeight: 1.08, maxWidth: 960 }}>{title}</div>
      <div style={{ display: "flex", marginTop: 28, fontSize: 27, color: "#9DB2D9", maxWidth: 940 }}>{tagline}</div>
    </div>
  );
}
