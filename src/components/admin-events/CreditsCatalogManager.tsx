"use client";

import { useState } from "react";

type Item = { id: string; title: string; description: string | null; cost: number; active: boolean; sort: number };
type Redemption = { id: string; title: string; cost: number; status: string; createdAt: string };

export function CreditsCatalogManager({
  initialItems,
  redemptions,
  enabled,
}: {
  initialItems: Item[];
  redemptions: Redemption[];
  enabled: boolean;
}) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/events/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: description.trim() || null, cost: Number(cost) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Couldn't add.");
      setItems((prev) => [...prev, json.item as Item]);
      setTitle("");
      setDescription("");
      setCost("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add.");
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, body: Partial<Item>) {
    const res = await fetch("/api/admin/events/credits", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    const json = await res.json();
    if (res.ok) setItems((prev) => prev.map((it) => (it.id === id ? (json.item as Item) : it)));
  }

  return (
    <div className="space-y-8">
      {!enabled && (
        <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The Points program is currently <b>disabled</b> (set <code>CREDITS_ENABLED=true</code> to turn it on). You can
          prepare the catalog now; nothing is earnable or redeemable until it&apos;s enabled and counsel has signed off.
        </div>
      )}

      <section>
        <h2 className="text-base font-semibold text-[var(--navy)]">Rewards catalog</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Services users can redeem Points for. Prices are in Points — never dollars. Do not add anything that offsets
          investment or deal costs.
        </p>

        <div className="mt-4 space-y-2">
          {items.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No items yet.</p>
          ) : (
            items.map((it) => (
              <div key={it.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-white px-4 py-3">
                <div className="min-w-[180px] flex-1">
                  <p className="text-sm font-medium text-[var(--navy)]">{it.title}</p>
                  {it.description && <p className="text-xs text-[var(--text-muted)]">{it.description}</p>}
                </div>
                <label className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                  Cost
                  <input
                    type="number"
                    min={1}
                    defaultValue={it.cost}
                    onBlur={(e) => {
                      const v = Math.round(Number(e.target.value));
                      if (v > 0 && v !== it.cost) patch(it.id, { cost: v });
                    }}
                    className="w-20 rounded-md border border-[var(--border-subtle)] px-2 py-1 text-sm"
                  />
                  Points
                </label>
                <button
                  onClick={() => patch(it.id, { active: !it.active })}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${it.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                >
                  {it.active ? "Active" : "Inactive"}
                </button>
              </div>
            ))
          )}
        </div>

        <form onSubmit={add} className="mt-4 grid gap-2 border-t border-[var(--border-subtle)] pt-4 sm:grid-cols-[1fr_1fr_120px_auto]">
          <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Reward title" className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm" />
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm" />
          <input required type="number" min={1} value={cost} onChange={(e) => setCost(e.target.value)} placeholder="Cost" className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm" />
          <button type="submit" disabled={busy || !title.trim() || !cost} className="cap-btn-primary rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50">
            {busy ? "Adding…" : "Add reward"}
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      </section>

      <section>
        <h2 className="text-base font-semibold text-[var(--navy)]">Recent redemptions</h2>
        {redemptions.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--text-muted)]">No redemptions yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border-subtle)] bg-white">
            {redemptions.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-[var(--navy)]">{r.title}</span>
                <span className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                  <span>{new Date(r.createdAt).toLocaleDateString()}</span>
                  <span className="font-semibold text-rose-600">−{r.cost.toLocaleString()} Points</span>
                  <span className="capitalize">{r.status}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
