"use client";

import { useState } from "react";

/**
 * Founder one-pager drafter (spec §5, §7). Collects a few plain inputs and posts
 * to /api/ai task "draft_onepager" (free-text). The model invents no metrics —
 * it only shapes what the founder provides into a starting draft they'll edit.
 */

const FIELDS = [
  { name: "company", label: "Company & what you do", placeholder: "e.g. Pallet — inventory forecasting for mid-market retailers", rows: 1 },
  { name: "problem", label: "Problem", placeholder: "Who hurts, and how much?", rows: 2 },
  { name: "solution", label: "Solution", placeholder: "What you built and why it's different", rows: 2 },
  { name: "traction", label: "Traction (only what's real)", placeholder: "Revenue, growth, customers, pilots — leave blank if early", rows: 2 },
  { name: "ask", label: "The ask", placeholder: "e.g. Raising $1.5M seed to reach $1M ARR", rows: 1 },
] as const;

export function OnePagerDrafter() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const get = (n: string) => (form.elements.namedItem(n) as HTMLTextAreaElement)?.value.trim() ?? "";
    const lines = FIELDS.map((f) => `${f.label}: ${get(f.name) || "(not provided)"}`).join("\n");
    if (FIELDS.every((f) => !get(f.name))) {
      setError("Add at least a line or two so there's something to shape.");
      return;
    }
    setBusy(true);
    setError(null);
    setDraft(null);
    setCopied(false);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "draft_onepager", messages: [{ role: "user", content: lines }] }),
      });
      if (res.status === 429) {
        const d = await res.json().catch(() => null);
        setError(d?.error ?? "You've hit the request limit — please try again shortly.");
        return;
      }
      const data = (await res.json().catch(() => null)) as { ok?: boolean; text?: string } | null;
      if (data?.ok && data.text) setDraft(data.text);
      else setError("Couldn't draft that just now. Please try again in a moment.");
    } catch {
      setError("Network trouble reaching the drafter. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <form onSubmit={submit} className="space-y-3">
        {FIELDS.map((f) => (
          <label key={f.name} className="block text-[13px] font-medium text-site-navy">{f.label}
            <textarea name={f.name} rows={f.rows} maxLength={800} placeholder={f.placeholder} className="mt-1 w-full rounded-lg border border-site-line bg-white px-3 py-2 text-sm font-normal text-site-ink outline-none focus:border-site-blue-hi" />
          </label>
        ))}
        {error ? <p className="rounded-lg bg-site-amber/10 px-3 py-2 text-[13px] text-site-amber" role="status">{error}</p> : null}
        <button type="submit" disabled={busy} className="w-full rounded-lg bg-site-blue px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi disabled:opacity-60">{busy ? "Drafting…" : "Draft my one-pager"}</button>
      </form>

      <div className="rounded-2xl border border-site-line bg-site-paper p-5">
        {draft ? (
          <div role="status" aria-live="polite">
            <div className="flex items-center justify-between">
              <span className="font-site-mono text-[11px] uppercase tracking-wide text-site-muted">Starting draft — edit freely</span>
              <button type="button" onClick={copy} className="rounded-md border border-site-line bg-white px-2.5 py-1 text-[12px] text-site-ink transition-colors hover:border-site-blue-hi hover:text-site-blue-hi">{copied ? "Copied" : "Copy"}</button>
            </div>
            <pre className="mt-3 whitespace-pre-wrap font-site-body text-[13px] leading-6 text-site-ink">{draft}</pre>
          </div>
        ) : (
          <div className="flex h-full min-h-40 items-center justify-center text-center">
            <p className="max-w-xs text-[13px] leading-6 text-site-muted">Your draft appears here. It uses only what you type — no invented metrics — as a starting point you&apos;ll refine.</p>
          </div>
        )}
      </div>
    </div>
  );
}
