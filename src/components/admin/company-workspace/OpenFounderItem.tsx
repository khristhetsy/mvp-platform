"use client";

import { useState } from "react";

/**
 * Open control for a founder-menu item. With the act_on_behalf permission it
 * starts an acting-as session for this founder, then opens the founder screen in
 * a new tab (the guarded cookie applies there). Without it, a plain read-only
 * link. Authorization is enforced server-side regardless of this flag.
 */
export function OpenFounderItem({
  href,
  founderId,
  canActOnBehalf,
}: Readonly<{ href: string; founderId: string | null; canActOnBehalf: boolean }>) {
  const [busy, setBusy] = useState(false);

  if (!canActOnBehalf || !founderId) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-lg border border-slate-200 px-2.5 py-1 text-[12px] font-medium text-slate-600 hover:bg-slate-50"
      >
        Open
      </a>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await fetch("/api/admin/act-on-behalf", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ founderId }),
          });
          if (res.ok) {
            window.open(href, "_blank", "noopener");
          } else {
            const j = await res.json().catch(() => ({}));
            alert(j.error ?? "Could not start acting on behalf.");
          }
        } finally {
          setBusy(false);
        }
      }}
      className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-[12px] font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60"
    >
      {busy ? "Opening…" : "Open as founder"}
    </button>
  );
}
