"use client";

import { useState } from "react";

type Preview = {
  scanned: number; capped: boolean; willWrite: number; fromOdoo: number; fromFormD: number; existing: number; none: number;
  detectedLabels: { label: string; n: number }[];
  distribution: { type: string; n: number }[];
  sample: { id: string; from: string; types: string[] }[];
};

/** Super-admin action to assign Investor Type across all investors. Preview → Apply. */
export function BackfillInvestorTypeButton() {
  const [open, setOpen] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [applied, setApplied] = useState<string | null>(null);

  async function run(mode: "preview" | "apply") {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/admin/contacts/backfill-investor-type", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, overwrite, label: label.trim() || undefined }),
      });
      const j = await r.json();
      if (!r.ok) { setMsg(j.error ?? "Failed."); return; }
      if (mode === "preview") { setPreview(j); setApplied(null); }
      else { setApplied(`Applied to ${j.applied.toLocaleString()} investors (${j.fromOdoo.toLocaleString()} from Odoo, ${j.fromFormD.toLocaleString()} from Form D).`); setPreview(null); }
    } finally { setBusy(false); }
  }

  const box: React.CSSProperties = { background: "var(--muted)", borderRadius: 8, padding: "8px 11px", fontSize: 11.5, color: "var(--muted-foreground)" };

  return (
    <>
      <button type="button" onClick={() => { setOpen(true); setPreview(null); setApplied(null); setMsg(null); }} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, border: "0.5px solid #C7D2E4", background: "#EEF3FC", color: "#185FA5", cursor: "pointer", fontWeight: 500 }}>
        <i className="ti ti-wand" aria-hidden="true" /> Assign investor type
      </button>

      {open && (
        <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 16, width: 560, maxWidth: "100%", maxHeight: "88vh", overflow: "auto", boxShadow: "0 20px 48px rgba(0,0,0,.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Assign Investor Type</p>
              <button onClick={() => setOpen(false)} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--muted-foreground)" }}>✕</button>
            </div>
            <p style={{ fontSize: 11.5, color: "var(--muted-foreground)", margin: "0 0 12px" }}>
              1 · Odoo <b>Investor Profile</b> → Investor Type. &nbsp; 2 · <b>SEC Form D</b> → Venture Capital + Fund Manager. Writes what the grid groups on; preview first.
            </p>

            {applied ? (
              <div style={{ padding: 12, textAlign: "center" }}>
                <p style={{ fontSize: 13, color: "#0F6E56", fontWeight: 500, margin: "0 0 12px" }}>✓ {applied}</p>
                <button onClick={() => setOpen(false)} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 8, padding: "8px 18px", cursor: "pointer" }}>Done</button>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted-foreground)" }}>
                    <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} style={{ width: 13, height: 13 }} /> Overwrite existing types
                  </label>
                  <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Odoo field label (optional — auto-detects)" style={{ flex: 1, minWidth: 180, fontSize: 12, padding: "6px 9px", borderRadius: 7, border: "0.5px solid var(--border)" }} />
                </div>

                {preview && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
                    <div style={box}>
                      Scanned <b>{preview.scanned.toLocaleString()}</b> investors{preview.capped ? " (capped)" : ""} · will set <b style={{ color: "#0F6E56" }}>{preview.willWrite.toLocaleString()}</b> — {preview.fromOdoo.toLocaleString()} from Odoo, {preview.fromFormD.toLocaleString()} from Form D. {preview.existing.toLocaleString()} already had a type{overwrite ? " (will overwrite)" : " (kept)"}, {preview.none.toLocaleString()} have no source (left Unassigned).
                    </div>
                    <div>
                      <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: "0 0 4px" }}>Detected Odoo field(s)</p>
                      {preview.detectedLabels.length === 0 ? <span style={{ fontSize: 11.5, color: "#8A5A00" }}>No investor-profile field auto-detected — enter its Odoo label above, then preview again.</span>
                        : preview.detectedLabels.map((d) => <span key={d.label} style={{ fontSize: 11, background: "#EEF2FF", color: "#3730A3", borderRadius: 6, padding: "2px 8px", marginRight: 6 }}>{d.label} · {d.n.toLocaleString()}</span>)}
                    </div>
                    <div>
                      <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: "0 0 4px" }}>Resulting distribution</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {preview.distribution.map((d) => <span key={d.type} style={{ fontSize: 11, background: "#E8F5F1", color: "#0F6E56", borderRadius: 6, padding: "2px 8px" }}>{d.type} · {d.n.toLocaleString()}</span>)}
                      </div>
                    </div>
                    {preview.sample.length > 0 && (
                      <div style={{ border: "0.5px solid #eef1f5", borderRadius: 7, overflow: "hidden", fontSize: 11 }}>
                        {preview.sample.map((s) => (
                          <div key={s.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "5px 10px", borderTop: "0.5px solid #f4f6f9" }}>
                            <span style={{ color: "var(--muted-foreground)" }}>{s.from}</span><span>{s.types.join(", ")}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {msg && <p style={{ fontSize: 11.5, color: "#A32D2D", margin: "0 0 10px" }}>{msg}</p>}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button onClick={() => run("preview")} disabled={busy} style={{ fontSize: 12, color: "var(--muted-foreground)", background: "transparent", border: "0.5px solid var(--border)", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>{busy ? "…" : "Preview"}</button>
                  <button onClick={() => run("apply")} disabled={busy || !preview || preview.willWrite === 0} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", opacity: !preview || preview.willWrite === 0 ? 0.5 : 1 }}>Apply{preview ? ` · ${preview.willWrite.toLocaleString()}` : ""}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
