"use client";

/**
 * Gear → Import from My contacts. My contacts (Stage 3) and this outreach list
 * are the same address book, so "importing" here means choosing who joins this
 * outreach: the picked contacts are added to the selection. Contacts already
 * selected, and contacts with no email, are shown but can't be picked.
 */

import { useMemo, useState } from "react";
import type { OutreachContact } from "./types";

const SOURCE_STYLE: Record<string, string> = {
  Introduced: "bg-emerald-50 text-emerald-700",
  Imported: "bg-indigo-50 text-indigo-700",
  "Added by you": "bg-slate-100 text-slate-600",
};

export function MyContactsPicker({
  contacts,
  selected,
  onClose,
  onAdd,
}: {
  contacts: OutreachContact[];
  selected: Set<string>;
  onClose: () => void;
  onAdd: (ids: string[]) => void;
}) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle
      ? contacts.filter((c) => [c.name, c.firm ?? "", c.email ?? "", c.investorType ?? "", c.sectors ?? ""].join(" ").toLowerCase().includes(needle))
      : contacts;
    // Pickable first, then already added, then no email.
    const rank = (c: OutreachContact) => (selected.has(c.id) ? 1 : c.email ? 0 : 2);
    return [...list].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  }, [contacts, q, selected]);

  const pickable = rows.filter((c) => c.email && !selected.has(c.id));
  const allPicked = pickable.length > 0 && pickable.every((c) => picked.has(c.id));

  function toggle(id: string) {
    setPicked((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-8" role="dialog" aria-modal="true" aria-label="Import from My contacts">
      <div className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-900">Import from My contacts</h2>
            <p className="text-xs text-slate-500">{contacts.length.toLocaleString()} contacts · pick who joins this outreach</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-2.5">
          <i className="ti ti-search text-slate-400" aria-hidden="true" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, firm, email, sector"
            className="min-w-0 flex-1 border-none bg-transparent text-[13px] outline-none"
            aria-label="Search My contacts"
          />
          {pickable.length > 0 ? (
            <button
              type="button"
              onClick={() => setPicked(allPicked ? new Set() : new Set(pickable.map((c) => c.id)))}
              className="shrink-0 text-xs font-medium text-[#1A6CE4] hover:underline"
            >
              {allPicked ? "Clear" : `Select all ${pickable.length}`}
            </button>
          ) : null}
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto">
          {rows.length === 0 ? (
            <li className="px-5 py-10 text-center text-[13px] text-slate-500">
              {contacts.length === 0 ? "My contacts is empty. Import a file or add an investor first." : "No contacts match that search."}
            </li>
          ) : (
            rows.map((c) => {
              const already = selected.has(c.id);
              const disabled = already || !c.email;
              return (
                <li key={c.id} className="border-b border-slate-100 last:border-b-0">
                  <label className={`flex items-center gap-3 px-5 py-2 ${disabled ? "cursor-default" : "cursor-pointer hover:bg-slate-50"}`}>
                    <input
                      type="checkbox"
                      disabled={disabled}
                      checked={already || picked.has(c.id)}
                      onChange={() => toggle(c.id)}
                      aria-label={`Pick ${c.name}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-[13px] font-medium ${disabled ? "text-slate-400" : "text-slate-900"}`}>{c.name}</span>
                      <span className="block truncate text-[11.5px] text-slate-400">{[c.firm, c.email].filter(Boolean).join(" · ") || "No details"}</span>
                    </span>
                    {already ? (
                      <span className="shrink-0 text-[11px] text-slate-400">Already in this outreach</span>
                    ) : !c.email ? (
                      <span className="shrink-0 text-[11px] text-amber-600">No email</span>
                    ) : (
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-medium ${SOURCE_STYLE[c.source] ?? SOURCE_STYLE["Added by you"]}`}>{c.source}</span>
                    )}
                  </label>
                </li>
              );
            })
          )}
        </ul>

        <div className="flex items-center gap-2 border-t border-slate-100 px-5 py-3">
          <span className="text-xs text-slate-500">{picked.size} picked</span>
          <span className="flex-1" />
          <button type="button" onClick={onClose} className="rounded-md border border-slate-200 px-3.5 py-1.5 text-[13px] text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onAdd([...picked])}
            disabled={picked.size === 0}
            className="cap-btn-primary rounded-md px-4 py-1.5 text-[13px] font-semibold disabled:opacity-50"
          >
            Add {picked.size || ""} to outreach
          </button>
        </div>
      </div>
    </div>
  );
}
