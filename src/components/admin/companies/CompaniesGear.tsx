"use client";

import { useState } from "react";

/**
 * Admin, Companies: the ⚙ menu holding the page's filters (users, stage, plan)
 * and the view switch. Same look as ToolbarGear, with one checked choice per
 * section.
 */
export type GearSection = {
  title: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
};

export function CompaniesGear({ sections }: { sections: GearSection[] }) {
  const [open, setOpen] = useState(false);
  const active = sections.filter((s) => s.title !== "View" && s.value !== "").length;
  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Filters and view"
        aria-haspopup="true"
        aria-expanded={open}
        style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, border: "0.5px solid var(--border-strong, #cbd5e1)", background: open ? "var(--muted)" : "#fff", color: "var(--muted-foreground)", cursor: "pointer" }}
      >
        <i className="ti ti-settings" style={{ fontSize: 16 }} aria-hidden="true" />
        {active > 0 && (
          <span style={{ position: "absolute", top: -5, right: -5, minWidth: 16, height: 16, borderRadius: 8, background: "#2E78F5", color: "#fff", fontSize: 10, fontWeight: 600, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>{active}</span>
        )}
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 39 }} />
          <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 40, width: 240, maxHeight: "70vh", overflowY: "auto", background: "#fff", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 10, boxShadow: "0 10px 28px rgba(0,0,0,0.14)", padding: "5px 0" }}>
            {sections.map((s, i) => (
              <div key={s.title}>
                {i > 0 && <div style={{ borderTop: "0.5px solid #eef1f5", margin: "4px 0" }} />}
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted-foreground)", padding: "6px 13px 4px" }}>{s.title}</div>
                {s.options.map((o) => {
                  const on = s.value === o.value;
                  return (
                    <button
                      key={o.value || "all"}
                      type="button"
                      onClick={() => { s.onChange(o.value); if (s.title === "View") setOpen(false); }}
                      style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 9, padding: "6px 13px", background: on ? "#F1F5F9" : "none", border: "none", cursor: "pointer", fontSize: 12.5, color: "var(--foreground)", fontWeight: on ? 600 : 400 }}
                    >
                      <i className="ti ti-check" style={{ fontSize: 14, color: "#2E78F5", visibility: on ? "visible" : "hidden" }} aria-hidden="true" />
                      <span>{o.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
