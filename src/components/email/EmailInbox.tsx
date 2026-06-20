"use client";

import { useCallback, useEffect, useState } from "react";
import { Mail, Send, Plus, X, RefreshCw } from "lucide-react";
import type { EmailThread, EmailMessage } from "@/lib/email/inbox";

function initials(name: string | null, email: string): string {
  const base = name ?? email;
  return base.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
}
function when(ts: string): string {
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function EmailInbox() {
  const [threads, setThreads] = useState<EmailThread[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [activeThread, setActiveThread] = useState<EmailThread | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [compose, setCompose] = useState({ to: "", subject: "", body: "" });
  const [error, setError] = useState<string | null>(null);

  const loadThreads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/email/threads");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load.");
      setThreads(data.threads ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadThreads(); }, [loadThreads]);

  // Deep link: /inbox?to=email&subject=... opens compose prefilled (used by CRM
  // "Email" buttons). Read once on mount from the URL.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const to = params.get("to");
    if (to) {
      setCompose({ to, subject: params.get("subject") ?? "", body: "" });
      setComposeOpen(true);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const openThread = useCallback(async (id: string) => {
    setSelected(id);
    setMessages([]);
    try {
      const res = await fetch(`/api/email/threads/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to open.");
      setActiveThread(data.thread);
      setMessages(data.messages ?? []);
      setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, unread: false } : t)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open.");
    }
  }, []);

  const sendReply = useCallback(async () => {
    if (!selected || !reply.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/email/threads/${selected}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Reply failed.");
      setMessages(data.messages ?? []);
      setReply("");
      await loadThreads();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reply failed.");
    } finally {
      setSending(false);
    }
  }, [selected, reply, loadThreads]);

  const sendCompose = useCallback(async () => {
    if (!compose.to.trim() || !compose.subject.trim() || !compose.body.trim()) {
      setError("To, subject and message are required.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/email/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(compose),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Send failed.");
      setComposeOpen(false);
      setCompose({ to: "", subject: "", body: "" });
      await loadThreads();
      if (data.thread?.id) await openThread(data.thread.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed.");
    } finally {
      setSending(false);
    }
  }, [compose, loadThreads, openThread]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-950">
          <Mail className="h-6 w-6 text-[var(--gold)]" strokeWidth={1.75} aria-hidden /> Inbox
        </h1>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void loadThreads()} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" aria-label="Refresh"><RefreshCw className="h-4 w-4" /></button>
          <button type="button" onClick={() => { setError(null); setComposeOpen(true); }} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"><Plus className="h-4 w-4" /> Compose</button>
        </div>
      </div>

      {error && !composeOpen ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[300px_minmax(0,1fr)]">
        {/* Thread list */}
        <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)]">
          {loading ? (
            <p className="px-4 py-6 text-sm text-slate-400">Loading…</p>
          ) : threads.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-400">No conversations yet. Compose to start one.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {threads.map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => void openThread(t.id)} className={`flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-slate-50 ${selected === t.id ? "bg-slate-50" : ""}`}>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EEEDFE] text-[11px] font-semibold text-[#3C3489]">{initials(t.contact_name, t.contact_email)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className={`truncate text-sm ${t.unread ? "font-semibold text-slate-950" : "text-slate-700"}`}>{t.contact_name ?? t.contact_email}</span>
                        <span className="shrink-0 text-[11px] text-slate-400">{when(t.last_message_at)}</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-xs text-slate-500">{t.subject ?? "(no subject)"}</span>
                        {t.unread ? <span className="h-2 w-2 shrink-0 rounded-full bg-[#534AB7]" /> : null}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Reading pane */}
        <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)]">
          {!activeThread ? (
            <div className="flex h-full min-h-[200px] items-center justify-center px-4 py-10 text-sm text-slate-400">Select a conversation</div>
          ) : (
            <div className="flex flex-col">
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="text-sm font-semibold text-slate-950">{activeThread.subject ?? "(no subject)"}</p>
                <p className="text-xs text-slate-500">{activeThread.contact_name ? `${activeThread.contact_name} · ` : ""}{activeThread.contact_email}</p>
              </div>
              <div className="max-h-[420px] space-y-3 overflow-y-auto px-4 py-3">
                {messages.map((m) => (
                  <div key={m.id} className={`rounded-lg border p-3 text-sm ${m.direction === "outbound" ? "border-[#CECBF6] bg-[#EEEDFE]/40" : "border-slate-200 bg-white"}`}>
                    <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
                      <span className="font-medium text-slate-700">{m.direction === "outbound" ? "You" : (m.from_name ?? m.from_email)}</span>
                      <span>{new Date(m.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-slate-800">{m.body_text ?? ""}</p>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-100 p-3">
                <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} placeholder="Write a reply…" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[var(--blue)] focus:outline-none" />
                <div className="mt-2 flex justify-end">
                  <button type="button" onClick={() => void sendReply()} disabled={sending || !reply.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"><Send className="h-4 w-4" /> {sending ? "Sending…" : "Send"}</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Compose modal */}
      {composeOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setComposeOpen(false)}>
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <h2 className="text-sm font-semibold text-slate-950">New message</h2>
              <button type="button" onClick={() => setComposeOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3 px-5 py-4">
              {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p> : null}
              <input value={compose.to} onChange={(e) => setCompose({ ...compose, to: e.target.value })} placeholder="To (email)" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <input value={compose.subject} onChange={(e) => setCompose({ ...compose, subject: e.target.value })} placeholder="Subject" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <textarea value={compose.body} onChange={(e) => setCompose({ ...compose, body: e.target.value })} rows={6} placeholder="Write your message…" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3">
              <button type="button" onClick={() => setComposeOpen(false)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={() => void sendCompose()} disabled={sending} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"><Send className="h-4 w-4" /> {sending ? "Sending…" : "Send"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
