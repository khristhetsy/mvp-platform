"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Gear icon in the contact header. Holds the contact-level options that should not sit
 * beside Call / Email / Message / Contracts: Archive contact, or Restore contact once the
 * contact is archived. The parent owns the save; this only renders the menu.
 */
export function ContactGearMenu({ archived, busy, onArchive, onRestore }: {
  archived: boolean;
  busy: boolean;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  function run(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        type="button"
        aria-label="Contact options"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Contact options"
        onClick={() => setOpen((o) => !o)}
        style={{ width: 32, height: 32, borderRadius: 7, border: "0.5px solid var(--border-strong, #cbd5e1)", background: open ? "var(--muted, #f1f5f9)" : "transparent", color: "var(--muted-foreground)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}
      >
        <i className="ti ti-settings" aria-hidden="true" />
      </button>
      {open ? (
        <div role="menu" style={{ position: "absolute", top: 38, right: 0, zIndex: 20, width: 200, background: "#fff", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 10, padding: 6 }}>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", padding: "6px 10px 4px" }}>Contact options</div>
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            onClick={() => run(archived ? onRestore : onArchive)}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 7, border: "none", background: "transparent", fontSize: 13, textAlign: "left", cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}
            onMouseOver={(e) => { e.currentTarget.style.background = "var(--muted, #f1f5f9)"; }}
            onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <i className={archived ? "ti ti-arrow-back-up" : "ti ti-archive"} aria-hidden="true" style={{ fontSize: 17, color: "var(--muted-foreground)" }} />
            <span>{archived ? "Restore contact" : "Archive contact"}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
