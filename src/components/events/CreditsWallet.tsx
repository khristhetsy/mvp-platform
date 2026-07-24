"use client";

import { useState } from "react";
import Link from "next/link";

type Item = { id: string; title: string; description: string | null; cost: number };
type Entry = { id: string; delta: number; label: string; createdAt: string };

/** User-facing iCFO Credits wallet. Displays a Credits-only balance (never a
 *  dollar value), the redeemable catalog, and earn/redeem history. */
export function CreditsWallet({
  initialBalance,
  catalog,
  history: initialHistory,
}: {
  initialBalance: number;
  catalog: Item[];
  history: Entry[];
}) {
  const [balance, setBalance] = useState(initialBalance);
  const [history, setHistory] = useState(initialHistory);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function redeem(item: Item) {
    if (balance < item.cost || busyId) return;
    setBusyId(item.id);
    setMsg(null);
    try {
      const res = await fetch("/api/credits/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Couldn't redeem.");
      setBalance(json.balance as number);
      setHistory((prev) => [
        { id: json.redemptionId as string, delta: -item.cost, label: `Redeemed — ${item.title}`, createdAt: new Date().toISOString() },
        ...prev,
      ]);
      setMsg({ kind: "ok", text: `Redeemed ${item.title}. Our team will apply it to your account.` });
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Couldn't redeem." });
    } finally {
      setBusyId(null);
    }
  }

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <div>
      {/* balance — Credits only, never a dollar value */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-white p-6 shadow-[var(--shadow-card)]">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Your balance</p>
        <p className="mt-1 text-4xl font-bold text-[var(--navy)]">
          {balance.toLocaleString()} <span className="text-lg font-semibold text-[var(--text-secondary)]">Points</span>
        </p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          No cash value · redeemable for iCFO services · <Link href="/legal/credits" className="underline">program terms</Link>
        </p>
      </div>

      {msg && (
        <div className={`mt-4 rounded-lg px-4 py-3 text-sm ${msg.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"}`}>
          {msg.text}
        </div>
      )}

      {/* redeem catalog */}
      <h2 className="mt-8 text-lg font-semibold text-[var(--navy)]">Redeem</h2>
      {catalog.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--text-muted)]">No rewards available yet — check back soon.</p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {catalog.map((item) => {
            const afford = balance >= item.cost;
            return (
              <div key={item.id} className="flex flex-col rounded-xl border border-[var(--border-subtle)] bg-white p-4">
                <p className="font-medium text-[var(--navy)]">{item.title}</p>
                {item.description && <p className="mt-1 flex-1 text-sm text-[var(--text-secondary)]">{item.description}</p>}
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-[var(--navy)]">{item.cost.toLocaleString()} Points</span>
                  <button
                    onClick={() => redeem(item)}
                    disabled={!afford || busyId === item.id}
                    className="cap-btn-primary rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                  >
                    {busyId === item.id ? "…" : afford ? "Redeem" : "Not enough"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* history */}
      <h2 className="mt-8 text-lg font-semibold text-[var(--navy)]">History</h2>
      {history.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--text-muted)]">Earn Points by joining events, watching sessions, and connecting.</p>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border-subtle)] bg-white">
          {history.map((e) => (
            <li key={e.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="text-[var(--text-primary)]">{e.label}</span>
              <span className="flex items-center gap-3">
                <span className="text-xs text-[var(--text-muted)]">{fmtDate(e.createdAt)}</span>
                <span className={`font-semibold ${e.delta >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {e.delta >= 0 ? "+" : ""}{e.delta.toLocaleString()}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
