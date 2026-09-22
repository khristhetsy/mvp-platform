"use client";

import { useState } from "react";
import type { IntroTemplate, TemplateKind } from "@/lib/icfo-events/introductions-server";

const TOKENS = [
  ["{{first_name}}", "the investor's first name"],
  ["{{founder_line}}", "name — company"],
  ["{{founder_name}}", ""],
  ["{{founder_company}}", ""],
  ["{{founder_pitch}}", "their one-line pitch"],
  ["{{founder_stage_line}}", "stage · raising · round size"],
  ["{{founder_stage}}", ""],
  ["{{founder_raising}}", ""],
  ["{{founder_round}}", ""],
  ["{{investor_line}}", "name — company"],
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
  peer_invitation: {
    title: "Peer invitation",
    note: "Between equals — two investors, or a service provider and a founder. Nobody is pitching anybody.",
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
export function IntroTemplatesEditor({ initial, eventId, testAddresses, gmail }: Readonly<{
  initial: IntroTemplate[];
  /** The event a test is built from — its strongest unsent match. */
  eventId: string;
  /** Where a test may be sent. Empty means the control does not render. */
  testAddresses: string[];
  /** The signed-in staff member's Google account, when it can send. */
  gmail: { available: boolean; address: string | null; reason: string | null };
}>) {
  const [tab, setTab] = useState<TemplateKind>("invitation");
  const [drafts, setDrafts] = useState(
    Object.fromEntries(initial.map((t) => [t.kind, { subject: t.subject, body: t.body }])) as
      Record<TemplateKind, { subject: string; body: string }>,
  );
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [testTo, setTestTo] = useState(testAddresses[0] ?? "");
  const [testBusy, setTestBusy] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const draft = drafts[tab] ?? { subject: "", body: "" };
  const set = (patch: Partial<{ subject: string; body: string }>) =>
    setDrafts((d) => ({ ...d, [tab]: { ...d[tab], ...patch } }));

  async function sendTest() {
    setTestBusy(true); setTestMsg(null); setTestError(null);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/introductions/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testTo }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        to?: string; shape?: string; rows?: number; investor?: string; founder?: string; error?: string;
      };
      if (!res.ok) { setTestError(json.error ?? "Could not send the test."); return; }
      setTestMsg(
        json.shape === "digest"
          ? `Sent to ${json.to} — the digest ${json.investor} would get, with ${json.rows} founders.`
          : `Sent to ${json.to} — the invitation ${json.investor} would get about ${json.founder}.`,
      );
    } catch {
      setTestError("Network error. Please try again.");
    } finally {
      setTestBusy(false);
    }
  }

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
        {(["invitation", "peer_invitation", "follow_up"] as TemplateKind[]).map((k) => (
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

          <div className="mt-4 rounded-lg border border-dashed border-[var(--border-subtle)] bg-slate-50/60 p-3">
            <p className="mb-2 text-[10.6px] font-bold uppercase tracking-[0.06em] text-[var(--text-muted)]">
              Added at send — not editable
            </p>
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-lg bg-[var(--blue)] px-3 py-1.5 text-[12px] font-semibold text-white">
                Accept the introduction →
              </span>
              <span className="rounded-lg border border-[var(--border-subtle)] bg-white px-3 py-1.5 text-[12px] font-semibold text-[var(--text-secondary)]">
                Not right now
              </span>
            </div>
            <p className="mt-2 text-[11px] text-[var(--text-muted)]">
              Declining is silent — nobody is told who declined.
            </p>
            <p className="mt-2 text-[10.6px] leading-relaxed text-[var(--text-muted)]">
              iCFO events are for education and community only. Nothing in this email is an offer to sell or a
              solicitation to buy any security. iCFO Capital Global, Inc. is not a broker-dealer, placement agent,
              or registered investment adviser, and no funding outcome is promised.
            </p>
          </div>

          <div className="mt-4 border-t border-[var(--border-subtle)] pt-3.5">
            <p className="text-[10.6px] font-bold uppercase tracking-[0.06em] text-[var(--text-muted)]">
              Send from
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border-2 border-[var(--blue)] bg-[var(--blue-muted)] p-2.5">
                <p className="text-[12.5px] font-semibold text-[var(--navy)]">iCapOS</p>
                <p className="text-[11.5px] text-[var(--text-secondary)]">the platform address</p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--text-muted)]">
                  Replies come back into the platform, so the board can show who answered.
                </p>
              </div>
              <div className={`rounded-lg border p-2.5 ${gmail.available ? "border-[var(--border-subtle)]" : "border-dashed border-[var(--border-subtle)] opacity-70"}`}>
                <p className="text-[12.5px] font-semibold text-[var(--navy)]">Gmail</p>
                <p className="text-[11.5px] text-[var(--text-secondary)]">
                  {gmail.address ?? "your connected Google account"}
                </p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--text-muted)]">
                  {gmail.available
                    ? "Sent through your Google account and kept in your Sent folder."
                    : gmail.reason}
                </p>
              </div>
            </div>
            <p className="mt-2 rounded-lg border border-dashed border-amber-300 bg-amber-50/70 px-2.5 py-2 text-[11px] leading-relaxed text-amber-900">
              Choosing Gmail moves the conversation out of iCapOS: replies arrive in your inbox rather than the
              reply hook, so &ldquo;awaiting an answer&rdquo; stops updating for those rows and the follow-ups keep
              chasing people who already answered. Worth it for a handful of hand-picked introductions, not for a
              hundred. The sender is chosen on the Matches tab, next to Introduce.
            </p>
          </div>

          {testAddresses.length > 0 && eventId ? (
            <div className="mt-4 border-t border-[var(--border-subtle)] pt-3.5">
              <p className="text-[10.6px] font-bold uppercase tracking-[0.06em] text-[var(--text-muted)]">
                Send a test to
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {testAddresses.map((addr) => (
                  <button
                    key={addr}
                    type="button"
                    onClick={() => { setTestTo(addr); setTestMsg(null); setTestError(null); }}
                    className={`rounded-lg px-3 py-1.5 text-[12.4px] ${
                      testTo === addr
                        ? "border-2 border-[var(--blue)] bg-[var(--blue-muted)] font-semibold text-[var(--navy)]"
                        : "border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-slate-50"
                    }`}
                  >
                    {addr}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => void sendTest()}
                  disabled={testBusy || !testTo}
                  className="rounded-lg border border-[var(--navy)] px-3.5 py-1.5 text-[12.4px] font-semibold text-[var(--navy)] disabled:opacity-50"
                >
                  {testBusy ? "Sending…" : "Send a test"}
                </button>
              </div>
              {testMsg ? <p className="mt-2 text-[12px] text-emerald-700">{testMsg}</p> : null}
              {testError ? <p className="mt-2 text-[12px] text-rose-700">{testError}</p> : null}
              <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-muted)]">
                Real data from the strongest match on this event — whichever shape that investor would really
                receive. Creates no introduction, mails nobody else, and its buttons do nothing.
              </p>
            </div>
          ) : null}
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
          <p className="mt-2 text-[10.6px] leading-relaxed text-[var(--text-muted)]">
            A token you mistype stays visible in the mail, so the mistake shows up in a test send. A token the
            founder simply never answered removes its own line instead of leaving a gap.
          </p>
        </div>
      </div>
    </div>
  );
}
