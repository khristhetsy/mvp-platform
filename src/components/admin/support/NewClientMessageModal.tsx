"use client";

import { useState } from "react";
import type { PickerClient } from "@/lib/support/client-picker";
import { ClientPicker } from "./ClientPicker";
import type { StaffOption } from "./SupportQueueClient";

/**
 * Staff start a conversation with a client. It opens a normal support thread the
 * client replies to on their Support page. AI can rewrite or draft the message,
 * but nothing is applied until staff press Use suggestion, and nothing is sent
 * until they press Send message.
 */
export function NewClientMessageModal({
  staff,
  currentStaffId,
  aiDrafts,
  onClose,
  onCreated,
}: Readonly<{
  staff: StaffOption[];
  currentStaffId: string;
  aiDrafts: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}>) {
  const [client, setClient] = useState<PickerClient | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [emailClient, setEmailClient] = useState(true);
  const [assigneeId, setAssigneeId] = useState(currentStaffId);
  const [suggestion, setSuggestion] = useState<{ before: string; text: string } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function askAi(payload: Record<string, unknown>) {
    setAiBusy(true);
    setAiNote(null);
    try {
      const res = await fetch("/api/admin/support/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, assigneeId }),
      });
      const json = (await res.json()) as { draft?: string; unavailable?: boolean };
      if (json.draft) setSuggestion({ before: body, text: json.draft });
      else setAiNote("AI is not available right now. Write the message yourself.");
    } catch {
      setAiNote("AI is not available right now. Write the message yourself.");
    } finally {
      setAiBusy(false);
    }
  }

  const canRewrite = body.trim().length > 0;
  const canWrite = subject.trim().length > 0;

  async function send() {
    if (!client) return setError("Pick a client first.");
    if (!subject.trim() || !body.trim()) return setError("Add a subject and a message.");
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requesterId: client.id,
          subject: subject.trim(),
          body: body.trim(),
          assigneeId,
          emailRequester: emailClient,
        }),
      });
      const json = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !json.id) {
        setError(json.error ?? "Could not send the message.");
        return;
      }
      onCreated(json.id);
    } catch {
      setError("Could not send the message.");
    } finally {
      setSending(false);
    }
  }

  const chip =
    "rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50";
  const label = "mb-1 mt-3 block text-xs font-semibold text-slate-600";
  const field = "w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm focus:border-indigo-400 focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="New message to client">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">New message to client</h2>
            <p className="mt-0.5 text-xs text-slate-500">Starts a support thread the client can reply to.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        <div className="px-5 pb-4 pt-1">
          <label className={label} htmlFor="ncm-client">Client</label>
          <ClientPicker value={client} onChange={setClient} />

          <label className={label} htmlFor="ncm-subject">Subject</label>
          <input id="ncm-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={160} className={field} />

          <label className={label} htmlFor="ncm-body">Message</label>
          <textarea id="ncm-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} rows={6} className={field} />

          {aiDrafts ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-indigo-700">AI</span>
              <button type="button" className={chip} disabled={aiBusy || !canRewrite} onClick={() => askAi({ mode: "rewrite", tone: "shorter", base: body })}>Shorter</button>
              <button type="button" className={chip} disabled={aiBusy || !canRewrite} onClick={() => askAi({ mode: "rewrite", tone: "friendlier", base: body })}>Friendlier</button>
              <button type="button" className={chip} disabled={aiBusy || !canWrite} onClick={() => askAi({ mode: "write", subject: subject.trim(), requesterId: client?.id ?? null })}>
                Write it for me
              </button>
              {aiBusy ? <span className="text-[11px] text-slate-500">Working on it</span> : null}
            </div>
          ) : null}
          {aiNote ? <p className="mt-1 text-[11px] text-amber-700">{aiNote}</p> : null}

          {suggestion ? (
            <div className="mt-2 rounded-lg border border-indigo-200 bg-indigo-50/60 p-3 text-xs" aria-live="polite">
              {suggestion.before.trim() ? (
                <>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Before</p>
                  <p className="mb-2 whitespace-pre-wrap text-slate-500 line-through">{suggestion.before}</p>
                </>
              ) : null}
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">AI suggestion</p>
              <p className="whitespace-pre-wrap text-slate-800">{suggestion.text}</p>
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setSuggestion(null)}>
                  Keep mine
                </button>
                <button type="button" className="rounded-lg bg-indigo-600 px-3 py-1 font-semibold text-white hover:bg-indigo-700" onClick={() => { setBody(suggestion.text); setSuggestion(null); }}>
                  Use suggestion
                </button>
              </div>
            </div>
          ) : null}

          <p className={label}>How the client is told</p>
          <p className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked disabled aria-label="In app notification" /> In app notification, always sent
          </p>
          <label className="mt-1 flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={emailClient} onChange={(e) => setEmailClient(e.target.checked)} /> Email from iCapOS with a link to the thread
          </label>

          <label className={label} htmlFor="ncm-assignee">Assign thread to</label>
          <select id="ncm-assignee" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={field}>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.id === currentStaffId ? `${s.name} (me)` : s.name}</option>
            ))}
          </select>

          {error ? <p className="mt-3 text-xs font-medium text-red-600" role="alert">{error}</p> : null}

          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="button" onClick={send} disabled={sending} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
              {sending ? "Sending" : "Send message"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
