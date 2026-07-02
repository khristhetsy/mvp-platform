"use client";

// Admin-only inspector shown on the AEO preview page. Toggling it outlines and
// labels the citable answer block, sections, FAQ schema target, and locked footer,
// and shows the exact JSON-LD the public page emits. NEVER rendered on the public
// route — it lives only in /admin/marketing/aeo/[id]/preview.

import { useState } from "react";

export function XrayOverlay({ jsonLd }: { jsonLd: Record<string, unknown> }) {
  const [on, setOn] = useState(true);
  const [showSchema, setShowSchema] = useState(false);

  return (
    <>
      {on ? (
        <style>{`
          [data-aeo]{position:relative;outline:2px dashed #2E78F5;outline-offset:4px;border-radius:8px}
          [data-aeo]::before{content:attr(data-aeo);position:absolute;top:-10px;left:8px;background:#2E78F5;color:#fff;font-size:10px;font-weight:600;letter-spacing:.04em;padding:1px 6px;border-radius:4px;text-transform:uppercase;z-index:5}
          [data-aeo="citable-answer"]{outline-color:#0F6E56}
          [data-aeo="citable-answer"]::before{background:#0F6E56}
          [data-aeo="faq"]{outline-color:#185FA5}
          [data-aeo="faq"]::before{background:#185FA5}
          [data-aeo="compliance-footer"]{outline-color:#A32D2D}
          [data-aeo="compliance-footer"]::before{background:#A32D2D}
        `}</style>
      ) : null}

      <div style={{ position: "fixed", top: 16, right: 16, zIndex: 60, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button" onClick={() => setOn((v) => !v)}
            style={{ background: on ? "#2E78F5" : "#fff", color: on ? "#fff" : "#334155", border: "1px solid #2E78F5", borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 8px rgb(12 35 64 / 0.12)" }}
          >
            AEO X-ray {on ? "on" : "off"}
          </button>
          <button
            type="button" onClick={() => setShowSchema((v) => !v)}
            style={{ background: "#fff", color: "#334155", border: "1px solid #d7dce4", borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer", boxShadow: "0 2px 8px rgb(12 35 64 / 0.12)" }}
          >
            {showSchema ? "Hide" : "Show"} JSON-LD
          </button>
        </div>
        {showSchema ? (
          <pre style={{ maxWidth: 420, maxHeight: 360, overflow: "auto", background: "#0f172a", color: "#e2e8f0", fontSize: 11, lineHeight: 1.5, padding: 12, borderRadius: 10, boxShadow: "0 8px 24px rgb(12 35 64 / 0.22)", margin: 0 }}>
            {JSON.stringify(jsonLd, null, 2)}
          </pre>
        ) : null}
      </div>

      <div style={{ position: "fixed", bottom: 16, right: 16, zIndex: 60, background: "#EEF0FB", color: "#1A6CE4", border: "1px solid #CECBF6", borderRadius: 8, padding: "6px 10px", fontSize: 11, fontWeight: 500, maxWidth: 260 }}>
        Admin preview only — the X-ray never appears on the public page.
      </div>
    </>
  );
}
