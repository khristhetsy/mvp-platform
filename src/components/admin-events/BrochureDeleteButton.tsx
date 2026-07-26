"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Permanently delete a brochure edition, with an inline confirm. */
export function BrochureDeleteButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function del() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/events/brochure/${id}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (confirming) {
    return (
      <span className="flex items-center gap-2">
        <span className="text-[11px] text-[var(--text-muted)]">Delete “{title.slice(0, 18)}…”?</span>
        <button type="button" onClick={del} disabled={busy} className="text-xs font-semibold text-rose-600 hover:underline disabled:opacity-50">{busy ? "…" : "Yes"}</button>
        <button type="button" onClick={() => setConfirming(false)} className="text-xs font-semibold text-[var(--text-muted)] hover:underline">No</button>
      </span>
    );
  }
  return (
    <button type="button" onClick={() => setConfirming(true)} className="text-xs font-semibold text-rose-500 hover:underline">Delete</button>
  );
}
