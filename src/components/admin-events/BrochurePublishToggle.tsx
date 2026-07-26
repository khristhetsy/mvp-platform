"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Publish / unpublish a generated edition's digital PDF to its public link (§9). */
export function BrochurePublishToggle({ id, published }: { id: string; published: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/brochure/${id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !published }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't update.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      title={error ?? undefined}
      className={`text-xs font-semibold hover:underline disabled:opacity-50 ${
        error ? "text-[var(--danger,#c0392b)]" : published ? "text-[var(--text-muted)]" : "text-[var(--blue)]"
      }`}
    >
      {busy ? "…" : published ? "Unpublish" : "Publish"}
    </button>
  );
}
