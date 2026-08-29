"use client";

import { useState } from "react";

/**
 * Open control for a founder-menu item. "Open as founder" starts a guarded
 * acting-as session and opens the founder screen — but only for items whose page
 * has adopted the resolver (`actable`); otherwise opening would just redirect
 * staff, so we show a disabled "Soon" marker instead of a misleading button.
 * Authorization is always enforced server-side.
 */
export function OpenFounderItem({
  href,
  founderId,
  canActOnBehalf,
  actable,
}: Readonly<{ href: string; founderId: string | null; canActOnBehalf: boolean; actable: boolean }>) {
  const [busy, setBusy] = useState(false);

  // Page not yet wired for act-on-behalf → don't offer a dead-ending Open.
  if (!actable) {
    return (
      <span
        title="Opening as the founder isn't available for this screen yet."
        className="cursor-not-allowed rounded-lg border border-slate-200 px-2.5 py-1 text-[12px] font-medium text-slate-300"
      >
        Soon
      </span>
    );
  }

  if (!canActOnBehalf || !founderId) {
    return (
      <span
        title="Requires the act-on-behalf permission."
        className="cursor-not-allowed rounded-lg border border-slate-200 px-2.5 py-1 text-[12px] font-medium text-slate-300"
      >
        Open
      </span>
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
