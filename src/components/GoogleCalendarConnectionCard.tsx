"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import type { GoogleConnectionStatus } from "@/lib/integrations/connected-accounts";

export function GoogleCalendarConnectionCard({
  status,
  returnPath,
}: Readonly<{
  status: GoogleConnectionStatus;
  returnPath: "/founder/settings" | "/investor/settings";
}>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const flash = useMemo(() => {
    const google = searchParams.get("google");
    if (google === "connected") {
      return { type: "success" as const, message: "Google account connected successfully." };
    }
    if (google === "error") {
      const message = searchParams.get("message") ?? "Connection failed.";
      return { type: "error" as const, message };
    }
    return null;
  }, [searchParams]);

  async function disconnect() {
    setLoading(true);
    setError(null);

    const response = await fetch("/api/integrations/google/disconnect", { method: "POST" });
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    setLoading(false);

    if (!response.ok) {
      setError(body?.error ?? "Unable to disconnect Google account.");
      return;
    }

    router.refresh();
  }

  if (!status.configured) {
    return (
      <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <h2 className="text-lg font-semibold text-slate-950">Google Calendar</h2>
        <p className="mt-2 text-sm text-amber-900">
          Google connection is not available yet. An administrator must configure Google OAuth environment
          variables.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-slate-50/80 p-6">
      <h2 className="text-lg font-semibold text-slate-950">Google Calendar</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Used for future Google Calendar and Google Meet scheduling. When you accept a meeting, your connected
        Google account will host the calendar event; both parties can be added as attendees in a later phase.
      </p>

      {flash ? (
        <p
          className={`mt-3 rounded-xl px-3 py-2 text-sm ${
            flash.type === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {flash.message}
        </p>
      ) : null}

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
            status.connected ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"
          }`}
        >
          {status.connected ? "Connected" : "Not connected"}
        </span>
        {status.connected && status.email ? (
          <span className="text-sm text-slate-700">{status.email}</span>
        ) : null}
      </div>

      {status.connected && status.connectedAt ? (
        <p className="mt-2 text-xs text-slate-500">
          Connected {new Date(status.connectedAt).toLocaleString("en-US", { timeZone: "UTC" })}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        {status.connected ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => void disconnect()}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50"
          >
            {loading ? "Disconnecting…" : "Disconnect Google"}
          </button>
        ) : (
          <a
            href={`/api/integrations/google/connect?returnTo=${encodeURIComponent(returnPath)}`}
            className="inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Connect Google account
          </a>
        )}
      </div>
    </section>
  );
}
