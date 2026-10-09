"use client";

import { useState } from "react";

/** "View the full deal, free": records the opt in, then follows the returned link. */
export function DealOptInButton({ token }: Readonly<{ token: string }>) {
  const [busy, setBusy] = useState<"signup" | "signin" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function go(mode: "signup" | "signin") {
    setBusy(mode);
    setError(null);
    try {
      const res = await fetch(`/api/deal/${encodeURIComponent(token)}/opt-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const payload = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !payload.url) throw new Error(payload.error ?? "Could not open this deal. Please try again.");
      window.location.href = payload.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open this deal. Please try again.");
      setBusy(null);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => go("signup")}
        disabled={busy !== null}
        className="w-full rounded-lg bg-[#1A6CE4] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#2E78F5] disabled:opacity-60 sm:w-auto"
      >
        {busy === "signup" ? "Opening…" : "View the full deal, free"}
      </button>
      <p className="mt-3 text-sm text-slate-600">Viewing creates your free investor account. Investors never pay on iCapOS.</p>
      <p className="mt-2 text-sm text-slate-500">
        Already have an investor account?{" "}
        <button
          type="button"
          onClick={() => go("signin")}
          disabled={busy !== null}
          className="font-semibold text-[#1A6CE4] hover:underline disabled:opacity-60"
        >
          {busy === "signin" ? "Opening…" : "Sign in"}
        </button>
      </p>
      {error ? <p className="mt-3 text-sm text-red-700" role="alert">{error}</p> : null}
    </div>
  );
}
