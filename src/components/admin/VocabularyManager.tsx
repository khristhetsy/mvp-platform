"use client";

/**
 * The words every form offers.
 *
 * Renaming is safe and archiving is reversible, so both are inline. There is
 * no delete: an answer pointing at a removed value would have nowhere to
 * resolve, and the failure would show up as a missing match rather than an
 * error anyone could see.
 */

import { useMemo, useState } from "react";
import type { VocabularyList } from "@/lib/vocabulary/lists";

export type ManagedOption = {
  id: string;
  list: VocabularyList;
  slug: string;
  label: string;
  sort_order: number;
  archived: boolean;
};

/** Display order and copy for each list. Weight is the matching weight, where the factor has one. */
const LISTS: { key: VocabularyList; title: string; weight?: number; note: string }[] = [
  { key: "industry", title: "Industry", weight: 25, note: "Founder, investor, event registration, sector tracks, sponsor targeting." },
  { key: "funding_stage", title: "Funding stage", weight: 20, note: "The round being raised." },
  { key: "operating_stage", title: "Operating stage", note: "The company itself. Not scored today." },
  { key: "investor_type", title: "Investor type", weight: 10, note: "What the founder seeks, and what the investor is." },
  { key: "capital_type", title: "Capital type", weight: 10, note: "Founders answer it. No investor is asked, so the factor never scores." },
  { key: "geography", title: "Geography", weight: 10, note: "Regions for matching. Not yet asked as a selection." },
  { key: "use_of_funds", title: "Use of funds", note: "Founder profile. Not scored today." },
  { key: "revenue_band", title: "Revenue bands", weight: 6, note: "Shared by annual revenue size, revenue stage, ARR, MRR and EBITDA." },
  { key: "business_entity", title: "Business entity", note: "Founder profile. Not scored today." },
];

const CARD = "rounded-xl border border-slate-200 bg-white";

export function VocabularyManager({ initial }: Readonly<{ initial: ManagedOption[] }>) {
  const [rows, setRows] = useState<ManagedOption[]>(initial);
  const [open, setOpen] = useState<VocabularyList | null>("industry");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState<VocabularyList | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "bad"; text: string } | null>(null);

  const byList = useMemo(() => {
    const m = new Map<VocabularyList, ManagedOption[]>();
    for (const r of rows) {
      const bucket = m.get(r.list) ?? [];
      bucket.push(r);
      m.set(r.list, bucket);
    }
    for (const [, v] of m) v.sort((a, b) => a.sort_order - b.sort_order);
    return m;
  }, [rows]);

  async function send(method: "POST" | "PATCH", body: Record<string, unknown>) {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/vocabulary", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { option?: ManagedOption; error?: string };
    setBusy(false);
    if (!res.ok || !json.option) {
      setMsg({ kind: "bad", text: json.error ?? "That didn't save." });
      return null;
    }
    return json.option;
  }

  async function add(list: VocabularyList) {
    const saved = await send("POST", { list, label: newLabel });
    if (!saved) return;
    setRows((p) => [...p, saved]);
    setNewLabel("");
    setAdding(null);
    setMsg({ kind: "ok", text: `Added “${saved.label}”. It is now offered everywhere this list is used.` });
  }

  async function rename(row: ManagedOption) {
    if (draft.trim() === row.label) { setEditing(null); return; }
    const saved = await send("PATCH", { list: row.list, slug: row.slug, label: draft });
    if (!saved) return;
    setRows((p) => p.map((r) => (r.id === saved.id ? saved : r)));
    setEditing(null);
    setMsg({ kind: "ok", text: `Renamed. Every record on “${saved.slug}” now reads “${saved.label}” and still matches.` });
  }

  async function setArchived(row: ManagedOption, archived: boolean) {
    const saved = await send("PATCH", { list: row.list, slug: row.slug, archived });
    if (!saved) return;
    setRows((p) => p.map((r) => (r.id === saved.id ? saved : r)));
    setMsg({
      kind: "ok",
      text: archived
        ? `“${saved.label}” is no longer offered. Records already on it keep it and still match.`
        : `“${saved.label}” is offered again.`,
    });
  }

  return (
    <div className="space-y-3">
      {msg ? (
        <p className={`rounded-xl px-4 py-3 text-sm ${msg.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
          {msg.text}
        </p>
      ) : null}

      {LISTS.map((def) => {
        const all = byList.get(def.key) ?? [];
        const offered = all.filter((o) => !o.archived);
        const legacy = all.filter((o) => o.archived);
        const isOpen = open === def.key;

        return (
          <section key={def.key} className={CARD}>
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-slate-900">{def.title}</h2>
                <p className="mt-0.5 text-xs text-slate-500">{def.note}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-[11.5px] text-slate-500">
                  {offered.length} offered{legacy.length ? ` · ${legacy.length} retired` : ""}
                  {def.weight ? ` · weight ${def.weight}` : ""}
                </span>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : def.key)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                >
                  {isOpen ? "Close" : "Open"}
                </button>
              </div>
            </header>

            {isOpen ? (
              <div className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  {offered.map((o) => (
                    <span key={o.id} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 py-1 pl-3 pr-1.5 text-xs text-slate-700">
                      {editing === o.id ? (
                        <>
                          <input
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            className="w-44 rounded border border-indigo-400 px-2 py-0.5 text-xs outline-none"
                            autoFocus
                          />
                          <button type="button" onClick={() => rename(o)} disabled={busy} aria-label="Save"
                            className="rounded bg-emerald-600 px-1.5 py-0.5 text-[11px] font-semibold text-white disabled:opacity-50">Save</button>
                          <button type="button" onClick={() => setEditing(null)} aria-label="Cancel"
                            className="rounded border border-slate-300 px-1.5 py-0.5 text-[11px] text-slate-500">Undo</button>
                        </>
                      ) : (
                        <>
                          {o.label}
                          <button type="button" onClick={() => { setEditing(o.id); setDraft(o.label); }}
                            className="rounded px-1 text-[11px] text-slate-400 hover:text-slate-700" aria-label={`Rename ${o.label}`}>edit</button>
                          <button type="button" onClick={() => setArchived(o, true)} disabled={busy}
                            className="rounded px-1 text-[11px] text-slate-400 hover:text-amber-700 disabled:opacity-50" aria-label={`Retire ${o.label}`}>retire</button>
                        </>
                      )}
                    </span>
                  ))}

                  {adding === def.key ? (
                    <span className="inline-flex items-center gap-1.5">
                      <input
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        placeholder="New value"
                        className="w-48 rounded-full border border-indigo-400 px-3 py-1 text-xs outline-none"
                        autoFocus
                      />
                      <button type="button" onClick={() => add(def.key)} disabled={busy}
                        className="rounded-full bg-[var(--blue,#2E78F5)] px-3 py-1 text-xs font-semibold text-white disabled:opacity-50">Add</button>
                      <button type="button" onClick={() => { setAdding(null); setNewLabel(""); }}
                        className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-500">Cancel</button>
                    </span>
                  ) : (
                    <button type="button" onClick={() => setAdding(def.key)}
                      className="rounded-full border border-dashed border-slate-300 px-3 py-1 text-xs text-slate-500 hover:border-slate-400">
                      + Add
                    </button>
                  )}
                </div>

                {legacy.length ? (
                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <p className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-slate-400">Retired · still matches</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {legacy.map((o) => (
                        <span key={o.id} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 py-1 pl-3 pr-1.5 text-xs text-slate-500">
                          {o.label}
                          <button type="button" onClick={() => setArchived(o, false)} disabled={busy}
                            className="rounded px-1 text-[11px] text-slate-400 hover:text-emerald-700 disabled:opacity-50">restore</button>
                        </span>
                      ))}
                    </div>
                    <p className="mt-2 text-[11.5px] text-slate-500">
                      Not offered to anyone new. Records already holding one keep it and still match — nothing here has been merged into a similar value.
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        );
      })}

      <p className="px-1 text-[11.5px] leading-relaxed text-slate-500">
        Values are stored as a key and shown as a label, so renaming changes what people read and never orphans an answer.
        Nothing deletes.
      </p>
    </div>
  );
}
