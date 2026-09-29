"use client";

import { useState } from "react";
import Link from "next/link";

/** Odoo-style ⚙ menu beside the New button: imports, exports, page-level settings. */
export type GearItem =
  | { key: string; icon: string; label: string; onClick: () => void; hint?: string; sep?: boolean }
  | { key: string; icon: string; label: string; href: string; hint?: string; sep?: boolean };

export function ToolbarGear({ items, heading }: { items: GearItem[]; heading?: string }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  return (
    <div style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-label="More actions" aria-haspopup="true" aria-expanded={open}
        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, border: "0.5px solid var(--border-strong, #cbd5e1)", background: open ? "var(--muted)" : "#fff", color: "var(--muted-foreground)", cursor: "pointer" }}>
        <i className="ti ti-settings" style={{ fontSize: 16 }} aria-hidden="true" />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 39 }} />
          <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 40, width: 230, background: "#fff", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 10, boxShadow: "0 10px 28px rgba(0,0,0,0.14)", padding: "5px 0" }}>
            {heading && <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted-foreground)", padding: "6px 13px 4px" }}>{heading}</div>}
            {items.map((it) => {
              const inner = (
                <>
                  <i className={`ti ${it.icon}`} style={{ fontSize: 15, color: "var(--muted-foreground)" }} aria-hidden="true" />
                  <span style={{ flex: 1 }}>{it.label}</span>
                  {it.hint && <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>{it.hint}</span>}
                </>
              );
              const style: React.CSSProperties = { width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 9, padding: "8px 13px", background: "none", border: "none", cursor: "pointer", fontSize: 12.5, color: "var(--foreground)", textDecoration: "none" };
              return (
                <div key={it.key}>
                  {it.sep && <div style={{ borderTop: "0.5px solid #eef1f5", margin: "4px 0" }} />}
                  {"href" in it
                    ? <Link href={it.href} onClick={() => setOpen(false)} style={style}>{inner}</Link>
                    : <button type="button" onClick={() => { setOpen(false); it.onClick(); }} style={style}>{inner}</button>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/** Primary "New" button, Odoo-style, at the left of a list toolbar. */
export function NewButton({ label = "New", onClick, href }: { label?: string; onClick?: () => void; href?: string }) {
  const style: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 8, padding: "7px 14px", cursor: "pointer", textDecoration: "none", display: "inline-flex", alignItems: "center" };
  return href ? <Link href={href} style={style}>{label}</Link> : <button type="button" onClick={onClick} style={style}>{label}</button>;
}

/** Client-side CSV download for lists that are already fully loaded in the browser. */
export function downloadCsv(filename: string, header: string[], rows: unknown[][]) {
  const cell = (v: unknown) => { const s = v == null ? "" : Array.isArray(v) ? v.join("; ") : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const text = [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
