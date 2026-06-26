"use client";

import { useMemo, useState } from "react";
import { sectorLabel } from "@/lib/icfo-events/sectors";
import type { NetworkingSuggestion, NetworkingConnection } from "@/lib/icfo-events/networking";

function initials(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[var(--indigo-soft)] text-xs font-semibold text-[var(--indigo)]">
      {initials(name)}
    </div>
  );
}

export function NetworkingConnections({
  eventId,
  suggestions,
  initialConnections,
}: {
  eventId: string;
  suggestions: NetworkingSuggestion[];
  initialConnections: NetworkingConnection[];
}) {
  const [connections, setConnections] = useState<NetworkingConnection[]>(initialConnections);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Map of other-party profile id → connection (to reflect state on suggestions).
  const byOther = useMemo(() => {
    const m = new Map<string, NetworkingConnection>();
    for (const c of connections) m.set(c.otherProfileId, c);
    return m;
  }, [connections]);

  async function connect(toProfileId: string, name: string) {
    setBusy(toProfileId);
    setError(null);
    try {
      const res = await fetch("/api/events/networking/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, toProfileId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Could not send request.");
      setConnections((prev) => [
        ...prev,
        {
          id: String(json.id),
          eventId,
          fromId: "",
          toId: toProfileId,
          status: "requested",
          direction: "outgoing",
          otherName: name,
          otherProfileId: toProfileId,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send request.");
    } finally {
      setBusy(null);
    }
  }

  async function respond(connectionId: string, action: "accept" | "decline") {
    setBusy(connectionId);
    setError(null);
    try {
      const res = await fetch(`/api/events/networking/connect/${connectionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Could not respond.");
      setConnections((prev) =>
        prev.map((c) => (c.id === connectionId ? { ...c, status: action === "accept" ? "accepted" : "declined" } : c)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not respond.");
    } finally {
      setBusy(null);
    }
  }

  const incoming = connections.filter((c) => c.direction === "incoming" && c.status === "requested");
  const accepted = connections.filter((c) => c.status === "accepted");

  function suggestionAction(s: NetworkingSuggestion) {
    const existing = byOther.get(s.profileId);
    if (existing?.status === "accepted") return <span className="text-xs font-medium text-emerald-700">Connected</span>;
    if (existing?.status === "requested") return <span className="text-xs text-[var(--text-muted)]">Pending</span>;
    if (existing?.status === "declined") return <span className="text-xs text-[var(--text-muted)]">—</span>;
    return (
      <button
        onClick={() => connect(s.profileId, s.displayName)}
        disabled={busy === s.profileId}
        className="rounded-md border border-[var(--indigo)] px-2.5 py-1 text-xs font-medium text-[var(--indigo)] hover:bg-[var(--indigo-soft)] disabled:opacity-50"
      >
        {busy === s.profileId ? "…" : "Connect"}
      </button>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {error && <p className="text-sm text-rose-700">{error}</p>}

      {/* Incoming requests */}
      {incoming.length > 0 && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-5">
          <h3 className="font-semibold text-[var(--navy)]">Connection requests</h3>
          <ul className="mt-3 space-y-2">
            {incoming.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] px-3 py-2">
                <div className="flex items-center gap-3">
                  <Avatar name={c.otherName} />
                  <span className="text-sm font-medium text-[var(--navy)]">{c.otherName}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => respond(c.id, "accept")}
                    disabled={busy === c.id}
                    className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => respond(c.id, "decline")}
                    disabled={busy === c.id}
                    className="rounded-md border border-[var(--border-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Suggestions */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-5">
        <h3 className="font-semibold text-[var(--navy)]">Suggested connections</h3>
        {suggestions.length === 0 ? (
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            No matches yet. As more attendees opt in and share interests, sector-matched people will appear here.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {suggestions.map((s) => (
              <li key={s.profileId} className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] px-3 py-2">
                <div className="flex items-center gap-3">
                  <Avatar name={s.displayName} />
                  <div>
                    <div className="text-sm font-medium text-[var(--navy)]">{s.displayName}</div>
                    {s.sharedInterests.length > 0 && (
                      <div className="text-xs text-[var(--text-muted)]">
                        {s.sharedInterests.map((i) => sectorLabel(i)).join(", ")}
                      </div>
                    )}
                  </div>
                </div>
                {suggestionAction(s)}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          Names only — no contact details are shared until both sides accept.
        </p>
      </div>

      {/* Accepted connections */}
      {accepted.length > 0 && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-5">
          <h3 className="font-semibold text-[var(--navy)]">Your connections</h3>
          <ul className="mt-3 space-y-2">
            {accepted.map((c) => (
              <li key={c.id} className="flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] px-3 py-2">
                <Avatar name={c.otherName} />
                <span className="text-sm font-medium text-[var(--navy)]">{c.otherName}</span>
                <span className="ml-auto text-xs font-medium text-emerald-700">Connected</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
