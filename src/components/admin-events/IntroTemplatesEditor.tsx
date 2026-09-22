"use client";

import { useState } from "react";
import type { IntroTemplate, TemplateKind } from "@/lib/icfo-events/introductions-server";

const TOKENS = [
  ["{{first_name}}", "the investor's first name"],
  ["{{founder_name}}", ""],
  ["{{founder_company}}", ""],
  ["{{investor_name}}", ""],
  ["{{investor_company}}", ""],
  ["{{shared_line}}", "\", and you share X, Y\" — empty when nothing is shared"],
  ["{{shared_sectors}}", ""],
  ["{{event_title}}", ""],
] as const;

const LABEL: Record<TemplateKind, { title: string; note: string }> = {
  invitation: {
    title: "Invitation",
    note: "Goes to the investor, about the founder.",
  },
  follow_up: {
    title: "Founder follow-up",
    note: "Chases the investor on the founder's behalf. Twice at most, never after a decline.",
  },
};

const INP = "w-full rounded-lg border border-[var(--border-subtle)] px-2.5 py-1.5 text-[12.5px]";

/**
 * The two messages, edited rather than hard-coded.
 *
 * An unknown token is left visible in the rendered mail rather than blanked,
 * so a typo here shows up in a test send instead of silently leaving a gap.
 */
export function IntroTemplatesEditor({ initial }: Readonly<{ initial: IntroTemplate[] }>) {
  const [tab, setTab] = useState<TemplateKind>("invitation");
  const [drafts, setDrafts] = useState(
    Object.fromEntries(initial.map((t) => [t.kind, { subject: t.subject, body: t.body }])) as
      Record<TemplateKind, { subject: string; body: string }>,
  );
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const draft = drafts[tab] ?? { subject: "", body: "" };
  const set = (patch: Partial<{ subject: string; body: string }>) =>
    setDrafts((d) => ({ ...d, [tab]: { ...d[tab], ...patch } }));

  async function save() {
    setBusy(true); setError(null); setSaved(null);
    try {
      const res = await fetch("/api/admin/events/introductions/templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: tab, ...draft }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setError(json.error ?? "Could not save."); return; }
      setSaved("Saved.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-white">
      <div className="flex gap-0.5 border-b border-[var(--border-subtle)] bg-slate-50/70 px-3 pt-2.5">
        {(["invitation", "follow_up"] as TemplateKind[]).map((k) => (
          <button key={k} type="button" onClick={() => { setTab(k); setSaved(null); setError(null); }}
            className={`-mb-px rounded-t-lg border border-b-0 px-3.5 py-1.5 text-[12.4px] font-semibold ${
              tab === k ? "border-[var(--border-subtle)] bg-white text-[var(--navy)]" : "border-transparent text-slate-500"
            }`}>
            {LABEL[k].title}
          </button>
        ))}
      </div>

      <div className="grid gap-4 p-4 md:grid-cols-[1fr_230px]">
        <div>
          <p className="mb-3 text-[11.6px] text-[var(--text-muted)]">{LABEL[tab].note}</p>

          <label className="block">
            <span className="mb-1 block text-[10.6px] font-bold text-[var(--text-secondary)]">Subject</span>
            <input value={draft.subject} onChange={(e) => set({ subject: e.target.value })} className={INP} />
          </label>

          <label className="mt-3 block">
            <span className="mb-1 block text-[10.6px] font-bold text-[var(--text-secondary)]">Message</span>
            <textarea rows={10} value={draft.body} onChange={(e) => set({ body: e.target.value })}
              className={`${INP} font-mono text-[12px]`} />
          </label>

          <div className="mt-3 flex items-center gap-2">
            <button type="button" onClick={() => void save()} disabled={busy}
              className="rounded-lg bg-[var(--navy)] px-3.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
              {busy ? "Saving…" : "Save"}
            </button>
            {saved ? <span className="text-[12px] font-medium text-emerald-700">{saved}</span> : null}
            {error ? <span className="text-[12px] text-rose-700">{error}</span> : null}
          </div>

          <p className="mt-3 text-[11px] text-[var(--text-muted)]">
            The accept and decline buttons and the compliance footer are added when the mail is sent, and
            can&rsquo;t be removed here.
          </p>
        </div>

        <div>
          <p className="mb-1.5 text-[10.6px] font-bold uppercase tracking-[0.06em] text-[var(--text-muted)]">Tokens</p>
          <div className="rounded-lg border border-[var(--border-subtle)] bg-slate-50/50 p-2">
            {TOKENS.map(([token, hint]) => (
              <button key={token} type="button"
                onClick={() => set({ body: `${draft.body}${token}` })}
                className="block w-full rounded px-1.5 py-1 text-left font-mono text-[11px] text-slate-600 hover:bg-white">
                {token}
                {hint ? <span className="block font-sans text-[10px] text-slate-400">{hint}</span> : null}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[10.6px] text-[var(--text-muted)]">
            An unknown token stays visible in the mail rather than becoming a blank, so a typo shows up in a test
            send.
          </p>
        </div>
      </div>
    </div>
  );
}
