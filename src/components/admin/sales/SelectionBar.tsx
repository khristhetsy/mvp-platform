"use client";

import { useState } from "react";

/**
 * Odoo-style selection bar: "N selected → Select all M ×" and one Actions menu.
 * Used by Opportunities and the Pipeline list view (Contacts has its own richer
 * version because its actions open inline panels).
 */
export type SelectionAction = {
  key: string;
  icon: string;
  label: string;
  /** Plain action. */
  run?: () => void;
  /** Sub-menu: pick one option, then run with its value. */
  options?: { value: string; label: string }[];
  runWith?: (value: string) => void;
  danger?: boolean;
};

export function SelectionBar({ count, total, onSelectAll, onClear, actions, busy = false, heading = "Selected" }: {
  count: number; total: number; onSelectAll: () => void; onClear: () => void; actions: SelectionAction[]; busy?: boolean; heading?: string;
}) {
  const [open, setOpen] = useState(false);
  const [sub, setSub] = useState<string | null>(null);
  if (count === 0) return null;
  const all = count >= total;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", background: "#E6F1FB", borderBottom: "0.5px solid #B5D4F4", flexWrap: "wrap" }}>
      <span style={{ fontSize: 12.5, color: "#0C447C", fontWeight: 600, background: "#B5D4F4", borderRadius: 7, padding: "4px 10px" }}>{all ? `All ${total.toLocaleString()} selected` : `${count.toLocaleString()} selected`}</span>
      {!all && (
        <button type="button" onClick={onSelectAll} style={{ fontSize: 12.5, fontWeight: 500, color: "#185FA5", background: "none", border: "none", cursor: "pointer", padding: 0, display: "inline-flex", alignItems: "center", gap: 4 }}><i className="ti ti-arrow-right" aria-hidden="true" /> Select all {total.toLocaleString()}</button>
      )}
      <button type="button" onClick={onClear} aria-label="Clear selection" style={{ fontSize: 14, color: "#185FA5", background: "none", border: "none", cursor: "pointer", padding: 0, display: "inline-flex" }}><i className="ti ti-x" aria-hidden="true" /></button>
      <div style={{ marginLeft: "auto", position: "relative" }}>
        <button type="button" onClick={() => { setOpen((v) => !v); setSub(null); }} disabled={busy} style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", background: "#fff", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 7, padding: "6px 12px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, opacity: busy ? 0.6 : 1 }}>
          <i className="ti ti-settings" aria-hidden="true" /> {busy ? "Working…" : "Actions"} <i className="ti ti-chevron-down" style={{ fontSize: 12 }} aria-hidden="true" />
        </button>
        {open && <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 39 }} />
          <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 40, width: 230, background: "#fff", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 10, boxShadow: "0 10px 28px rgba(0,0,0,0.14)", padding: "6px 0" }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted-foreground)", padding: "6px 13px 4px" }}>{heading}</div>
            {actions.map((a) => (
              <div key={a.key}>
                <button type="button" onClick={() => { if (a.options) setSub(sub === a.key ? null : a.key); else { setOpen(false); a.run?.(); } }} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 9, padding: "8px 13px", background: sub === a.key ? "var(--muted)" : "none", border: "none", cursor: "pointer", fontSize: 12.5, color: a.danger ? "#A32D2D" : "var(--foreground)" }}>
                  <i className={`ti ${a.icon}`} style={{ fontSize: 15, color: a.danger ? "#A32D2D" : "var(--muted-foreground)" }} aria-hidden="true" />{a.label}
                  {a.options && <i className={`ti ti-chevron-${sub === a.key ? "down" : "right"}`} style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted-foreground)" }} aria-hidden="true" />}
                </button>
                {a.options && sub === a.key && (
                  <div style={{ maxHeight: 220, overflowY: "auto", borderTop: "0.5px solid #eef1f5", borderBottom: "0.5px solid #eef1f5", background: "#FAFBFD" }}>
                    {a.options.length === 0 && <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", padding: "6px 24px" }}>No options.</div>}
                    {a.options.map((o) => (
                      <button type="button" key={o.value} onClick={() => { setOpen(false); setSub(null); a.runWith?.(o.value); }} style={{ width: "100%", textAlign: "left", padding: "6px 13px 6px 37px", background: "none", border: "none", cursor: "pointer", fontSize: 12.5, color: "var(--foreground)" }}>{o.label}</button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>}
      </div>
    </div>
  );
}

/** Green one-line result strip, dismissable. */
export function ActionResult({ text, onClose }: { text: string | null; onClose: () => void }) {
  if (!text) return null;
  const isErr = /fail|couldn|only an admin/i.test(text);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", background: isErr ? "#FCEBEB" : "#E1F5EE", borderBottom: `0.5px solid ${isErr ? "#F7C1C1" : "#A7E0CE"}` }}>
      <i className={`ti ${isErr ? "ti-alert-circle" : "ti-circle-check"}`} style={{ color: isErr ? "#A32D2D" : "#0F6E56" }} aria-hidden="true" />
      <span style={{ fontSize: 12.5, color: isErr ? "#A32D2D" : "#0F6E56", fontWeight: 500 }}>{text}</span>
      <button type="button" onClick={onClose} style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer" }}><i className="ti ti-x" aria-hidden="true" /></button>
    </div>
  );
}

/** POST to a bulk endpoint and, for exports, trigger the browser download. */
export async function runBulk(url: string, body: Record<string, unknown>): Promise<{ ok: true; count: number; failed: number; file?: string } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const ct = res.headers.get("Content-Type") ?? "";
    if (res.ok && ct.startsWith("text/csv")) {
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "export.csv";
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = href; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(href);
      return { ok: true, count: 0, failed: 0, file: name };
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error ?? "Action failed." };
    return { ok: true, count: data.count ?? 0, failed: data.failed ?? 0 };
  } catch { return { ok: false, error: "Action failed — check your connection and retry." }; }
}
