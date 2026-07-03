"use client";

import { useMemo, useState } from "react";
import { Search, HelpCircle } from "lucide-react";
import type { UnclassifiedRecord } from "@/lib/crm/types";

const NAVY = "#0A1A40";

function rel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86_400_000);
  if (d < 1) return "today";
  if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

export function UnclassifiedTable({ records }: { records: UnclassifiedRecord[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return records;
    return records.filter((r) =>
      [r.name, r.email, r.company, r.membership, r.leadSource, ...r.signals]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle)),
    );
  }, [records, q]);

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, company, signal…"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-400"
          />
        </div>
        <span className="text-xs text-slate-500">{filtered.length.toLocaleString()} of {records.length.toLocaleString()}</span>
      </div>

      {records.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center">
          <HelpCircle className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-700">No unclassified contacts</p>
          <p className="mt-1 text-xs text-slate-500">Contacts with no member type and no investor profile land here after an import.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2.5 font-semibold">Name</th>
                <th className="px-4 py-2.5 font-semibold">Email</th>
                <th className="px-4 py-2.5 font-semibold">Member type</th>
                <th className="px-4 py-2.5 font-semibold">Profile signals</th>
                <th className="px-4 py-2.5 font-semibold">Source</th>
                <th className="px-4 py-2.5 font-semibold">Synced</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-medium" style={{ color: NAVY }}>
                    {r.name}
                    {r.company && r.company !== r.name && (
                      <span className="ml-1 text-xs font-normal text-slate-400">· {r.company}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{r.email ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    {r.membership ? (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">{r.membership}</span>
                    ) : (
                      <span className="text-xs text-slate-400">none</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {r.signals.length === 0 ? (
                        <span className="text-xs text-slate-400">—</span>
                      ) : (
                        r.signals.map((s, i) => (
                          <span key={i} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{s}</span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{r.leadSource ?? "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">{rel(r.lastActivity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
