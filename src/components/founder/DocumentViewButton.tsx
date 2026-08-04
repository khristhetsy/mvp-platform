"use client";

import { useState } from "react";

/**
 * Opens an uploaded document in a new tab via a short-lived signed URL.
 * Access is enforced server-side by /api/documents/signed-url.
 */
export function DocumentViewButton({
  documentId,
  className,
  label = "View",
}: {
  documentId: string;
  className?: string;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function open() {
    if (loading) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/documents/signed-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      const data = (await res.json().catch(() => null)) as { signedUrl?: string } | null;
      if (res.ok && data?.signedUrl) {
        window.open(data.signedUrl, "_blank", "noopener,noreferrer");
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button type="button" onClick={open} disabled={loading} className={className}>
      {loading ? "Opening…" : error ? "Retry" : label}
    </button>
  );
}
