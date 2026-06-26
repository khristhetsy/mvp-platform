"use client";

import { useState } from "react";
import Link from "next/link";

export function RegisterButton({
  eventId,
  slug,
  isAuthenticated,
  alreadyRegistered,
}: {
  eventId: string;
  slug: string;
  isAuthenticated: boolean;
  alreadyRegistered: boolean;
}) {
  const [registered, setRegistered] = useState(alreadyRegistered);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isAuthenticated) {
    return (
      <Link
        href={`/auth/sign-in?next=/events/${slug}`}
        className="cap-btn-primary inline-flex items-center rounded-md px-4 py-2 text-sm font-medium"
      >
        Sign in to register
      </Link>
    );
  }

  if (registered) {
    return (
      <span className="inline-flex items-center rounded-md bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
        ✓ You&apos;re registered
      </span>
    );
  }

  async function register() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/register`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Could not register.");
      setRegistered(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not register.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={register}
        disabled={busy}
        className="cap-btn-primary inline-flex items-center rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {busy ? "Registering…" : "Register to attend"}
      </button>
      {error && <span className="text-xs text-rose-700">{error}</span>}
    </div>
  );
}
