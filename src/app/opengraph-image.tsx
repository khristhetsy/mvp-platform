import { ImageResponse } from "next/og";

export const alt = "CapitalOS — The operating system for capital-ready companies";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Brand OG image (1200×630) — navy #04143D with #0056F4 accent. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
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
          <div style={{ fontSize: 42, fontWeight: 700 }}>CapitalOS</div>
        </div>
        <div style={{ marginTop: 44, fontSize: 66, fontWeight: 700, lineHeight: 1.08, maxWidth: 940 }}>
          The operating system for{" "}
          <span style={{ color: "#5B8DEF" }}>capital-ready</span> companies.
        </div>
        <div style={{ marginTop: 30, fontSize: 28, color: "#9DB2D9" }}>
          AI diligence · investor readiness · private market
        </div>
      </div>
    ),
    { ...size },
  );
}
