"use client";

import { useMemo, useState } from "react";
import type { FormdContact } from "@/lib/formd/contacts";

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";

type Filter = "all" | "investor" | "founder";

export function FormdContactsPanel({ contacts }: Readonly<{ contacts: FormdContact[] }>) {
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  const counts = useMemo(
    () => ({
      all: contacts.length,
      investor: contacts.filter((c) => c.kind === "investor").length,
      founder: contacts.filter((c) => c.kind === "founder").length,
    }),
    [contacts],
  );

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return contacts.filter((c) => {
      if (filter !== "all" && c.kind !== filter) return false;
      if (!needle) return true;
      return c.name.toLowerCase().includes(needle) || (c.subtitle ?? "").toLowerCase().includes(needle);
    });
  }, [contacts, filter, q]);

  const chip = (key: Filter, label: string, n: number) => (
    <button
      type="button"
      onClick={() => setFilter(key)}
      className={`rounded-md px-2.5 py-1 text-xs font-medium ${filter === key ? "bg-indigo-50 text-indigo-700" : "bg-slate-50 text-slate-500 hover:text-slate-700"}`}
    >
      {label} · {n.toLocaleString()}
    </button>
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {chip("all", "All", counts.all)}
        {chip("investor", "Investors", counts.investor)}
        {chip("founder", "Founders", counts.founder)}
        <span className="flex-1" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search contacts" className="min-w-[200px] rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-xs" style={{ tableLayout: "fixed" }}>
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-500">
              <th className="px-3 py-2.5">NAME</th>
              <th className="w-24 px-3 py-2.5">TYPE</th>
              <th className="w-24 px-3 py-2.5">SOURCE</th>
              <th className="w-28 px-3 py-2.5">ADDED</th>
              <th className="w-24 px-3 py-2.5">STATUS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-slate-500">No promoted contacts yet. Promote firms or filings from the Form D Desk.</td></tr>
            ) : (
              rows.map((c) => (
                <tr key={c.id} className="align-top hover:bg-slate-50">
                  <td className="min-w-0 px-3 py-2.5">
                    <p className="truncate font-medium text-slate-900">{c.name}</p>
                    <p className="truncate text-[11px] text-slate-400">{c.subtitle || "—"}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    {c.kind === "investor" ? (
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: "var(--bg-accent)", color: "var(--text-accent)" }}>Investor</span>
                    ) : (
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: "var(--bg-pro)", color: "var(--text-pro)" }}>Founder</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-slate-500">SEC Form D</td>
                  <td className="px-3 py-2.5 text-slate-500">{fmtDate(c.addedAt)}</td>
                  <td className="px-3 py-2.5 text-slate-600">{c.status || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
