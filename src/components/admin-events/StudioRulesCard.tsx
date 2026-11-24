"use client";

import { useState } from "react";
import { STUDIO_RULE_LIMITS, type StudioRules } from "@/lib/icfo-events/studio";

type Key = keyof StudioRules;

const UNIT: Record<Key, string> = { spotlightBreakSeconds: "seconds" };

/** Playout rules for one event. Blank means not set: nothing assumes a length. */
export function StudioRulesCard({ eventId, rules, keys, canEdit, title }: { eventId: string; rules: StudioRules; keys: Key[]; canEdit: boolean; title: string }) {
  const [saved, setSaved] = useState(rules);
  const [draft, setDraft] = useState<Record<Key, string>>(() => Object.fromEntries(keys.map((k) => [k, rules[k] == null ? "" : String(rules[k])])) as Record<Key, string>);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    const body: Partial<Record<Key, number | null>> = {};
    for (const k of keys) body[k] = draft[k].trim() === "" ? null : Number(draft[k]);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/studio-rules`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = (await res.json().catch(() => ({}))) as { error?: string; rules?: StudioRules };
      if (!res.ok || !json.rules) throw new Error(json.error ?? "Couldn't save.");
      setSaved(json.rules);
      setMsg({ ok: true, text: "Saved." });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't save." });
    } finally {
      setBusy(false);
    }
  }

  const dirty = keys.some((k) => (draft[k].trim() === "" ? null : Number(draft[k])) !== saved[k]);

  return (
    <section className="rounded-xl border border-[var(--border-subtle)] bg-white p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h2>
        {canEdit ? (
          <button type="button" onClick={save} disabled={busy || !dirty} className="cap-btn-primary rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50">
            {busy ? "Saving…" : "Save rules"}
          </button>
        ) : null}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {keys.map((k) => (
          <label key={k} className="text-xs text-[var(--text-muted)]">
            {STUDIO_RULE_LIMITS[k].label} ({UNIT[k]})
            <input
              inputMode="numeric"
              value={draft[k]}
              disabled={!canEdit}
              onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value.replace(/[^0-9]/g, "") }))}
              placeholder="Not set"
              className="mt-1 block w-full rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
            />
          </label>
        ))}
      </div>
      {msg ? <p className={`mt-3 text-sm ${msg.ok ? "text-emerald-700" : "text-rose-700"}`}>{msg.text}</p> : null}
    </section>
  );
}
