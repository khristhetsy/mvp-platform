"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { matchRows, type SearchField } from "@/lib/ui/live-search";
import { Highlight, NoSearchMatches, SearchCount } from "@/components/ui/SearchStatus";
import type { CoachFounderRow } from "@/lib/learning/coach/admin";
import { COACH_TONES, TONE_LABELS, type CoachTone } from "@/lib/learning/coach/tones";

const FIELDS: SearchField<CoachFounderRow>[] = [
  { label: "founder", get: (r) => r.name },
  { label: "email", get: (r) => r.email },
  { label: "company", get: (r) => r.company },
  { label: "coach status", get: (r) => r.status },
  { label: "style", get: (r) => (r.tone ? TONE_LABELS[r.tone].label : "") },
];

const STATUS_STYLE: Record<CoachFounderRow["status"], string> = {
  active: "bg-green-50 text-green-700",
  paused: "bg-amber-50 text-amber-700",
  ended: "bg-slate-100 text-slate-600",
  off: "bg-slate-50 text-slate-400",
};

export function CoachFoundersPanel({ rows }: Readonly<{ rows: CoachFounderRow[] }>) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [tone, setTone] = useState<CoachTone>("driven");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const result = useMemo(() => matchRows(rows, FIELDS, query), [rows, query]);

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function call(url: string, method: string, body: unknown) {
    setBusy(true);
    setMessage(null);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setBusy(false);
    const data = res ? ((await res.json().catch(() => ({}))) as { error?: string; enrolled?: number; skipped?: unknown[] }) : {};
    if (!res?.ok) {
      setMessage(data.error ?? "Could not save.");
      return false;
    }
    if (typeof data.enrolled === "number") {
      const skipped = data.skipped?.length ?? 0;
      setMessage(`${data.enrolled} enrolled${skipped ? `, ${skipped} skipped (already active, no company or internal)` : ""}.`);
    }
    router.refresh();
    return true;
  }

  async function enrollSelected() {
    if (picked.size === 0) return;
    if (await call("/api/admin/learning/coach/enrollments", "POST", { mode: "selected", founderIds: [...picked], tone })) setPicked(new Set());
  }

  async function enrollAll() {
    if (!window.confirm("Enroll every founder with a company, except internal accounts? Each founder can pause the coach.")) return;
    await call("/api/admin/learning/coach/enrollments", "POST", { mode: "all", tone });
  }

  const rowAction = (r: CoachFounderRow, action: "pause" | "resume" | "end") =>
    r.companyId ? call("/api/admin/learning/coach/enrollments", "PATCH", { founderId: r.id, companyId: r.companyId, action }) : Promise.resolve(false);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          aria-label="Search founders"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search founders, companies, status"
          className="min-w-[220px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
        <select
          aria-label="Coaching style for new enrollments"
          value={tone}
          onChange={(e) => setTone(e.target.value as CoachTone)}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"
        >
          {COACH_TONES.map((t) => (
            <option key={t} value={t}>
              Style: {TONE_LABELS[t].label}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={busy || picked.size === 0}
          onClick={() => void enrollSelected()}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
        >
          Enroll selected{picked.size ? ` (${picked.size})` : ""}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void enrollAll()}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          Enroll all
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <SearchCount result={result} noun="founders" />
        {message ? <p className="text-xs text-slate-600" aria-live="polite">{message}</p> : null}
      </div>

      {result.active && result.rows.length === 0 ? (
        <div className="mt-3">
          <NoSearchMatches query={query} fields={FIELDS.map((f) => f.label)} onClear={() => setQuery("")} />
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              <tr>
                <th className="w-8 px-3 py-2" />
                <th className="px-3 py-2">Founder</th>
                <th className="px-3 py-2">Company</th>
                <th className="px-3 py-2">Coach</th>
                <th className="px-3 py-2">Style</th>
                <th className="px-3 py-2">Last step</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2">
                    <input type="checkbox" aria-label={`Select ${r.name}`} checked={picked.has(r.id)} onChange={() => toggle(r.id)} disabled={!r.companyId} />
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-medium text-slate-900"><Highlight text={r.name} query={query} /></p>
                    <p className="text-xs text-slate-400"><Highlight text={r.email} query={query} /></p>
                  </td>
                  <td className="px-3 py-2 text-slate-600"><Highlight text={r.company} query={query} /></td>
                  <td className="px-3 py-2">
                    <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS_STYLE[r.status]}`}>{r.status}</span>
                    {r.status === "active" && r.quietDays !== null && r.quietDays >= 14 ? (
                      <span className="ml-1.5 rounded-md bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">Reach out</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">{r.tone ? TONE_LABELS[r.tone].label : "—"}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{r.lastActivity ?? "—"}</td>
                  <td className="px-3 py-2 text-right text-xs">
                    {r.status === "active" ? (
                      <button type="button" disabled={busy} onClick={() => void rowAction(r, "pause")} className="font-medium text-slate-600 hover:underline">Pause</button>
                    ) : r.status === "paused" ? (
                      <button type="button" disabled={busy} onClick={() => void rowAction(r, "resume")} className="font-medium text-indigo-700 hover:underline">Resume</button>
                    ) : null}
                    {r.status === "active" || r.status === "paused" ? (
                      <button type="button" disabled={busy} onClick={() => void rowAction(r, "end")} className="ml-3 font-medium text-red-600 hover:underline">End</button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
