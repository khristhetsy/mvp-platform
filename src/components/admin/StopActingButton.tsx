"use client";

import { useState } from "react";

export function StopActingButton() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await fetch("/api/admin/act-on-behalf", { method: "DELETE" });
        } finally {
          window.location.reload();
        }
      }}
      className="rounded-lg border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-60"
    >
      {busy ? "Exiting…" : "Exit to admin"}
    </button>
  );
}
