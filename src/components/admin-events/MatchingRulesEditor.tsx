"use client";

import { useState } from "react";
import { PAIR_TYPES, type PairTypeKey } from "@/lib/icfo-events/pair-types";

type Yield = { pairs: number; median: number | null };

/**
 * Which pairings this event generates.
 *
 * Every rule shows what it would produce before you switch it on, because
 * "Match all" at an event with 101 investors and 4 founders is almost entirely
 * investor-to-investor, and that is not obvious from the label.
 */
export function MatchingRulesEditor({ eventId, initial, byPairType }: Readonly<{
  eventId: string;
  initial: PairTypeKey[];
  byPairType: Record<string, Yield>;
}>) {
  const [picked, setPicked] = useState<Set<PairTypeKey>>(new Set(initial));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const total = PAIR_TYPES.reduce(
    (sum, t) => sum + (picked.has(t.key) ? byPairType[t.key]?.pairs ?? 0 : 0),
    0,
  );
  const all = PAIR_TYPES.reduce((sum, t) => sum + (byPairType[t.key]?.pairs ?? 0), 0);

  function toggle(key: PairTypeKey) {
    setMsg(null);
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function save() {
    setBusy(true); setMsg(null); setError(null);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/matching-rules`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pairTypes: [...picked] }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setError(json.error ?? "Could not save."); return; }
      setMsg("Saved. The board reloads with these pairings.");
      window.location.reload();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-white">
      <div className="border-b border-[var(--border-subtle)] px-3.5 py-3">
        <p className="text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
          Who may be matched with whom at this event. Tick a pairing and it is generated; untick it and those rows
          leave the board. Introductions already sent stay sent.
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <button type="button" onClick={() => setPicked(new Set(PAIR_TYPES.map((t) => t.key)))}
            className="rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-secondary)]">
            Match all
          </button>
          <button type="button" onClick={() => setPicked(new Set())}
            className="rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-secondary)]">
            Clear
          </button>
        </div>
      </div>

      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-50 text-left text-[10.4px] uppercase tracking-wide text-[var(--text-muted)]">
            <th className="w-9 px-3.5 py-2" />
            <th className="px-3.5 py-2 font-bold">Pairing</th>
            <th className="w-20 px-3.5 py-2 text-right font-bold">Pairs</th>
            <th className="w-24 px-3.5 py-2 text-right font-bold">Median score</th>
          </tr>
        </thead>
        <tbody>
          {PAIR_TYPES.map((t) => {
            const y = byPairType[t.key];
            return (
              <tr key={t.key} className="border-t border-[var(--border-subtle)]">
                <td className="px-3.5 py-2.5">
                  <input
                    type="checkbox"
                    aria-label={t.label}
                    checked={picked.has(t.key)}
                    onChange={() => toggle(t.key)}
                    className="h-3.5 w-3.5 accent-[var(--navy)]"
                  />
                </td>
                <td className="px-3.5 py-2.5">
                  <span className="block font-medium text-[var(--navy)]">{t.label}</span>
                  <span className="block text-[10.5px] text-[var(--text-muted)]">{t.note}</span>
                </td>
                <td className="px-3.5 py-2.5 text-right tabular-nums text-[var(--navy)]">
                  {(y?.pairs ?? 0).toLocaleString()}
                </td>
                <td className="px-3.5 py-2.5 text-right tabular-nums text-[var(--text-secondary)]">
                  {y?.median ?? "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border-subtle)] px-3.5 py-3">
        <button type="button" disabled={busy} onClick={() => void save()}
          className="rounded-lg bg-[var(--navy)] px-3.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
          {busy ? "Saving…" : "Save rules"}
        </button>
        <span className="text-[11.5px] text-[var(--text-muted)]">
          {total.toLocaleString()} pair{total === 1 ? "" : "s"} with these rules · {all.toLocaleString()} if you
          match all
        </span>
        {msg ? <span className="text-[12px] text-emerald-700">{msg}</span> : null}
        {error ? <span className="text-[12px] text-rose-700">{error}</span> : null}
      </div>

      <p className="border-t border-dashed border-[var(--border-subtle)] bg-slate-50/60 px-3.5 py-2.5 text-[11.5px] leading-relaxed text-[var(--text-secondary)]">
        A pairing between equals uses the peer invitation, not the one written to an investor about a founder — two
        investors are not pitching each other. There is no Advisor registration type: service providers are the
        nearest thing, so a pairing reading 0 usually means nobody registered as one.
      </p>
    </div>
  );
}
