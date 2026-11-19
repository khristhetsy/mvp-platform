"use client";

import { useEffect, useRef, useState } from "react";
import type { PickerClient } from "@/lib/support/client-picker";
import { Highlight, NoSearchMatches } from "@/components/ui/SearchStatus";

type Tab = "all" | "founder" | "investor";
type Totals = { founder: number; investor: number };

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Pick the client for a new message from a list instead of typing a full name.
 * Opens on the newest accounts, narrows with the Founders and Investors tabs,
 * and filters as staff type (name, company, email). The server returns the
 * match counts, so the list says plainly when it is not showing everyone.
 */
export function ClientPicker({
  value,
  onChange,
}: Readonly<{ value: PickerClient | null; onChange: (c: PickerClient | null) => void }>) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [clients, setClients] = useState<PickerClient[]>([]);
  const [totals, setTotals] = useState<Totals>({ founder: 0, investor: 0 });
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const seq = useRef(0);
  const box = useRef<HTMLDivElement>(null);

  // Load while the list is open; typing refines it after a short pause.
  useEffect(() => {
    if (!open) return;
    const n = ++seq.current;
    const t = setTimeout(
      async () => {
        try {
          const res = await fetch(`/api/admin/support/clients?q=${encodeURIComponent(q.trim())}`);
          const json = (await res.json()) as { clients?: PickerClient[]; totals?: Totals };
          if (!res.ok) throw new Error("load failed");
          if (n !== seq.current) return;
          setClients(json.clients ?? []);
          setTotals(json.totals ?? { founder: 0, investor: 0 });
          setState("ready");
        } catch {
          if (n === seq.current) setState("error");
        }
      },
      q.trim() ? 200 : 0,
    );
    return () => clearTimeout(t);
  }, [open, q]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const shown = clients.filter((c) => tab === "all" || c.role === tab);
  const totalForTab = tab === "all" ? totals.founder + totals.investor : totals[tab];
  const query = q.trim();

  function pick(c: PickerClient) {
    onChange(c);
    setOpen(false);
    setQ("");
  }

  if (value) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm">
        <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-indigo-50 text-[11px] font-bold text-indigo-700">{initials(value.name)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-slate-900">{value.name}</span>
          <span className="block truncate text-xs text-slate-500">
            {[value.company, value.email, value.role].filter(Boolean).join(" · ")}
          </span>
        </span>
        <button
          type="button"
          className="text-xs font-semibold text-indigo-700 hover:underline"
          onClick={() => {
            onChange(null);
            setOpen(true);
          }}
        >
          Change
        </button>
      </div>
    );
  }

  const tabs: Array<{ key: Tab; label: string; count: number }> = [
    { key: "all", label: "All", count: totals.founder + totals.investor },
    { key: "founder", label: "Founders", count: totals.founder },
    { key: "investor", label: "Investors", count: totals.investor },
  ];

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        id="ncm-client"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center rounded-lg border px-2.5 py-2 text-left text-sm ${open ? "border-indigo-400 ring-2 ring-indigo-100" : "border-slate-200"}`}
      >
        <span className="flex-1 text-slate-400">Select a founder or investor</span>
        <i className="ti ti-chevron-down text-slate-400" aria-hidden="true" />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 p-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter by name, company or email"
              aria-label="Filter clients"
              className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
              autoComplete="off"
              autoFocus
            />
          </div>
          <div className="flex gap-1.5 px-2 pb-1 pt-2" role="tablist" aria-label="Client type">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tab === t.key ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
              >
                {t.label} <span className="tabular-nums">{state === "ready" ? t.count : ""}</span>
              </button>
            ))}
          </div>

          <div className="max-h-64 overflow-y-auto py-1" role="listbox" aria-label="Clients">
            {state === "loading" ? <p className="px-3 py-3 text-xs text-slate-500">Loading clients</p> : null}
            {state === "error" ? <p className="px-3 py-3 text-xs text-red-600">Could not load clients. Close this list and open it again.</p> : null}
            {state === "ready" && shown.length === 0 ? (
              query ? (
                <div className="p-2">
                  <NoSearchMatches query={query} fields={["name", "company", "email"]} onClear={() => setQ("")} />
                </div>
              ) : (
                <p className="px-3 py-3 text-xs text-slate-500">No founders or investors yet.</p>
              )
            ) : null}
            {state === "ready"
              ? shown.map((c, i) => (
                  <div key={c.id}>
                    {tab === "all" && (i === 0 || shown[i - 1].role !== c.role) ? (
                      <p className="px-3 pb-0.5 pt-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">{c.role === "founder" ? "Founders" : "Investors"}</p>
                    ) : null}
                    <button
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => pick(c)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50"
                    >
                      <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-indigo-50 text-[11px] font-bold text-indigo-700">{initials(c.name)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-900"><Highlight text={c.name} query={query} /></span>
                        <span className="block truncate text-xs text-slate-500">
                          {c.company ? <><Highlight text={c.company} query={query} /> · </> : null}
                          <Highlight text={c.email} query={query} />
                        </span>
                      </span>
                      <span className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-bold ${c.role === "founder" ? "bg-indigo-50 text-indigo-700" : "bg-emerald-50 text-emerald-700"}`}>{c.role}</span>
                      {c.plan ? <span className="flex-none rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{c.plan}</span> : null}
                    </button>
                  </div>
                ))
              : null}
          </div>

          {state === "ready" ? (
            <p className="border-t border-slate-100 px-3 py-1.5 text-[11px] text-slate-400">
              {shown.length < totalForTab
                ? `Showing ${shown.length} of ${totalForTab}, newest first. Type to narrow.`
                : `${shown.length} ${shown.length === 1 ? "client" : "clients"}${query ? " match" : ", newest first"}.`}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
