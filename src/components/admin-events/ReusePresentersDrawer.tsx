"use client";

import { useMemo, useState } from "react";
import {
  filterCandidates,
  reuseCandidates,
  type ReuseCandidate,
} from "@/lib/icfo-events/presenter-reuse";
import type { EventPresenter } from "@/lib/icfo-events/types";

type EventOpt = { id: string; title: string; timezone: string | null };

const I = "rounded-md border border-[var(--border-subtle)] px-2.5 py-1.5 text-xs";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((w) => /[a-z]/i.test(w))
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

/**
 * Copy people who have presented before onto another event.
 *
 * The list is built from the roster rows already loaded for the manager, so it
 * shows exactly what the admin can see. The server re-reads before inserting —
 * this is a picker, not the source of truth.
 */
export function ReusePresentersDrawer({
  all,
  events,
  onAdded,
  onClose,
}: Readonly<{
  all: EventPresenter[];
  events: EventOpt[];
  onAdded: (added: EventPresenter[]) => void;
  onClose: () => void;
}>) {
  const [targetId, setTargetId] = useState<string>(events[0]?.id ?? "");
  const [q, setQ] = useState("");
  const [fromEventId, setFromEventId] = useState("");
  const [role, setRole] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [keepBio, setKeepBio] = useState(true);
  const [keepHeadline, setKeepHeadline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);

  const candidates = useMemo(() => reuseCandidates(all, targetId), [all, targetId]);
  const shown = useMemo(
    () => filterCandidates(candidates, { q, fromEventId: fromEventId || undefined, role: role || undefined }),
    [candidates, q, fromEventId, role],
  );

  const roles = useMemo(
    () => [...new Set(candidates.map((c) => c.source.roleLabel).filter(Boolean))] as string[],
    [candidates],
  );
  const pastEvents = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of candidates) seen.set(c.source.eventId, c.source.eventTitle ?? "Untitled event");
    return [...seen].map(([id, title]) => ({ id, title }));
  }, [candidates]);

  function toggle(c: ReuseCandidate) {
    if (c.onTarget) return;
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(c.source.id)) next.delete(c.source.id);
      else next.add(c.source.id);
      return next;
    });
  }

  async function add() {
    if (!targetId || picked.size === 0) return;
    setBusy(true);
    setError(null);
    setSkipped([]);
    try {
      const res = await fetch(`/api/admin/events/${targetId}/presenters/reuse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceIds: [...picked], keepBio, keepHeadline }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        presenters?: EventPresenter[];
        skipped?: string[];
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Could not add them.");
      onAdded(json.presenters ?? []);
      if (json.skipped?.length) {
        setSkipped(json.skipped);
        setPicked(new Set());
      } else {
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add them.");
    } finally {
      setBusy(false);
    }
  }

  const targetTitle = events.find((e) => e.id === targetId)?.title ?? "—";

  return (
    <div className="overflow-hidden rounded-xl border border-sky-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-sky-100 bg-sky-50/70 px-3.5 py-2.5">
        <p className="text-[13px] font-semibold text-[var(--navy)]">Reuse previous presenters</p>
        <span className="text-[11.5px] text-[var(--text-muted)]">
          adding to <b className="text-[var(--navy)]">{targetTitle}</b>
        </span>
        <span className="flex-1" />
        <button type="button" onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-700">
          ✕
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-subtle)] px-3.5 py-2.5">
        <select value={targetId} onChange={(e) => { setTargetId(e.target.value); setPicked(new Set()); }} className={I}>
          {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, company or topic…"
          className={`${I} min-w-[180px] flex-1`}
        />
        <select value={fromEventId} onChange={(e) => setFromEventId(e.target.value)} className={I}>
          <option value="">Any past event</option>
          {pastEvents.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
        <select value={role} onChange={(e) => setRole(e.target.value)} className={I}>
          <option value="">Any role</option>
          {roles.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <span className="text-[11.5px] text-[var(--text-muted)]">
          {shown.length} {shown.length === 1 ? "person" : "people"}
          {picked.size > 0 ? <> · <b className="text-[var(--navy)]">{picked.size} selected</b></> : null}
        </span>
      </div>

      {shown.length === 0 ? (
        <p className="px-3.5 py-6 text-sm text-[var(--text-muted)]">
          {candidates.length === 0
            ? "Nobody has presented at another event yet — there is nothing to copy."
            : "No past presenter matches that search."}
        </p>
      ) : (
        <div className="max-h-[420px] overflow-y-auto">
          <div className="grid grid-cols-[26px_1.5fr_1.2fr_0.8fr] gap-2 border-b border-[var(--border-subtle)] bg-slate-50 px-3.5 py-2 text-[10.5px] uppercase tracking-wide text-[var(--text-muted)]">
            <span /><span>Person</span><span>Last presented</span><span>Role</span>
          </div>
          {shown.map((c) => {
            const p = c.source;
            const on = picked.has(p.id);
            return (
              <button
                type="button"
                key={c.key}
                onClick={() => toggle(c)}
                disabled={c.onTarget}
                className={`grid w-full grid-cols-[26px_1.5fr_1.2fr_0.8fr] items-center gap-2 border-b border-[var(--border-subtle)] px-3.5 py-2 text-left text-xs ${
                  c.onTarget ? "cursor-not-allowed opacity-50" : on ? "bg-sky-50/60" : "hover:bg-slate-50"
                }`}
              >
                <span
                  aria-hidden
                  className={`flex h-[15px] w-[15px] items-center justify-center rounded border text-[9px] text-white ${
                    on ? "border-[var(--navy)] bg-[var(--navy)]" : "border-slate-300"
                  }`}
                >
                  {on ? "✓" : ""}
                </span>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-slate-200 text-[9.5px] font-bold text-slate-600">
                    {initials(p.displayName)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-[var(--navy)]">{p.displayName}</span>
                    <span className="block truncate text-[10px] text-[var(--text-muted)]">{p.email ?? "no email on file"}</span>
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[var(--text-secondary)]">{p.eventTitle ?? "—"}</span>
                  <span className="block truncate text-[10px] text-[var(--text-muted)]">
                    {p.headline || "no topic"}
                    {c.appearances > 1 ? ` · ${c.appearances} events` : ""}
                  </span>
                </span>
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                    {p.roleLabel ?? "—"}
                  </span>
                  {c.onTarget ? (
                    <span className="flex-none rounded-full border border-[var(--border-subtle)] bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                      on roster
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border-subtle)] bg-slate-50/60 px-3.5 py-2.5">
        <label className="flex items-center gap-1.5 text-[11.8px] text-[var(--text-secondary)]">
          <input type="checkbox" checked={keepBio} onChange={(e) => setKeepBio(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--navy)]" />
          Keep their bio &amp; company summary
        </label>
        <label className="flex items-center gap-1.5 text-[11.8px] text-[var(--text-secondary)]" title="A headline describes the talk they gave, not the person.">
          <input type="checkbox" checked={keepHeadline} onChange={(e) => setKeepHeadline(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--navy)]" />
          Keep last event&rsquo;s talk topic
        </label>
        <span className="flex-1" />
        <button type="button" onClick={onClose} className="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)]">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void add()}
          disabled={busy || picked.size === 0}
          className="rounded-md bg-[var(--navy)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {busy ? "Adding…" : `Add ${picked.size || ""} to this event`.replace("  ", " ")}
        </button>
      </div>

      {error ? <p className="px-3.5 pb-2.5 text-xs text-rose-700">{error}</p> : null}
      {skipped.length ? (
        <p className="px-3.5 pb-2.5 text-xs text-amber-700">
          Already on this roster, so not copied: {skipped.join(", ")}.
        </p>
      ) : null}

      <p className="border-t border-[var(--border-subtle)] px-3.5 py-2 text-[10.6px] text-[var(--text-muted)]">
        Name, role, email, links, headshot and — when ticked — bio come across. The slot, session, Meet link and
        uploaded materials don&rsquo;t: they belong to the old event. This is a copy, not a link, so later edits to
        either roster stay where they&rsquo;re made.
      </p>
    </div>
  );
}
