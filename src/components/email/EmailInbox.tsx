"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Mail, Send, Plus, X, RefreshCw, Trash2, MailOpen, ArrowLeft, Search } from "lucide-react";
import type { ThreadListItem, EmailMessage } from "@/lib/email/inbox";

function when(ts: string): string {
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (d.getFullYear() === today.getFullYear()) return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}

type ActiveThread = { id: string; subject: string | null; contact_email: string; contact_name: string | null };

export function EmailInbox() {
  const [threads, setThreads] = useState<ThreadListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [active, setActive] = useState<ActiveThread | null>(null);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const [composeOpen, setComposeOpen] = useState(false);
  const [compose, setCompose] = useState({ to: "", subject: "", body: "" });

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

  // Deep link: /inbox?to=email&subject=... opens compose prefilled.
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

  const unreadCount = threads.filter((t) => t.unread).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter(
      (t) =>
        (t.contact_name ?? "").toLowerCase().includes(q) ||
        t.contact_email.toLowerCase().includes(q) ||
        (t.subject ?? "").toLowerCase().includes(q) ||
        (t.snippet ?? "").toLowerCase().includes(q),
    );
  }, [threads, search]);

  const openThread = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/email/threads/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to open.");
      setActive(data.thread);
      setMessages(data.messages ?? []);
      setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, unread: false } : t)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open.");
    }
  }, []);

  const markUnread = useCallback(async (id: string) => {
    setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, unread: true } : t)));
    try {
      await fetch(`/api/email/threads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unread: true }),
      });
    } catch {
      // best-effort
    }
  }, []);

  const deleteThread = useCallback(async (id: string) => {
    setThreads((prev) => prev.filter((t) => t.id !== id));
    if (active?.id === id) { setActive(null); setMessages([]); }
    try {
      await fetch(`/api/email/threads/${id}`, { method: "DELETE" });
    } catch {
      void loadThreads();
    }
  }, [active, loadThreads]);

  const sendReply = useCallback(async () => {
    if (!active || !reply.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/email/threads/${active.id}`, {
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
  }, [active, reply, loadThreads]);

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
          {unreadCount > 0 ? <span className="text-sm font-normal text-slate-400">{unreadCount} unread</span> : null}
        </h1>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void loadThreads()} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" aria-label="Refresh"><RefreshCw className="h-4 w-4" /></button>
          <button type="button" onClick={() => { setError(null); setComposeOpen(true); }} className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"><Plus className="h-4 w-4" /> Compose</button>
        </div>
      </div>

      {error && !composeOpen ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

      {active ? (
        /* ── Conversation view ── */
        <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)]">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <button type="button" onClick={() => { setActive(null); setMessages([]); }} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Back to inbox"><ArrowLeft className="h-4 w-4" /></button>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-950">{active.subject ?? "(no subject)"}</p>
                <p className="truncate text-xs text-slate-500">{active.contact_name ? `${active.contact_name} · ` : ""}{active.contact_email}</p>
              </div>
            </div>
            <button type="button" onClick={() => void deleteThread(active.id)} className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-400 hover:border-[#F7C1C1] hover:bg-[#FCEBEB] hover:text-[#A32D2D]" aria-label="Delete conversation"><Trash2 className="h-4 w-4" /></button>
          </div>
          <div className="max-h-[440px] space-y-3 overflow-y-auto px-4 py-3">
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
            <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} placeholder="Reply…" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[var(--blue)] focus:outline-none" />
            <div className="mt-2 flex justify-end">
              <button type="button" onClick={() => void sendReply()} disabled={sending || !reply.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"><Send className="h-4 w-4" /> {sending ? "Sending…" : "Send"}</button>
            </div>
          </div>
        </div>
      ) : (
        /* ── List view ── */
        <>
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2">
            <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search mail" className="w-full bg-transparent text-sm focus:outline-none" />
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)]">
            {loading ? (
              <p className="px-4 py-8 text-sm text-slate-400">Loading…</p>
            ) : threads.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-400">No conversations yet. Compose to start one.</p>
            ) : filtered.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-400">No conversations match &ldquo;{search}&rdquo;.</p>
            ) : (
              <ul>
                {filtered.map((t) => (
                  <li
                    key={t.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => void openThread(t.id)}
                    onKeyDown={(e) => { if (e.key === "Enter") void openThread(t.id); }}
                    className={`group flex cursor-pointer items-center gap-3 border-b border-slate-100 px-4 py-2.5 last:border-0 ${t.unread ? "bg-white hover:bg-slate-50" : "bg-slate-50/40 hover:bg-slate-50"}`}
                  >
                    <span className={`w-44 shrink-0 truncate text-sm ${t.unread ? "font-semibold text-slate-950" : "text-slate-600"}`}>
                      {t.contact_name ?? t.contact_email}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      <span className={t.unread ? "font-semibold text-slate-950" : "text-slate-700"}>{t.subject ?? "(no subject)"}</span>
                      {t.snippet ? <span className="text-slate-400"> — {t.snippet}</span> : null}
                    </span>
                    <span className="hidden shrink-0 items-center gap-2 group-hover:flex">
                      <button type="button" title="Mark unread" onClick={(e) => { e.stopPropagation(); void markUnread(t.id); }} className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"><MailOpen className="h-4 w-4" /></button>
                      <button type="button" title="Delete" onClick={(e) => { e.stopPropagation(); void deleteThread(t.id); }} className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-[#A32D2D]"><Trash2 className="h-4 w-4" /></button>
                    </span>
                    <span className={`w-16 shrink-0 text-right text-xs group-hover:hidden ${t.unread ? "font-semibold text-slate-900" : "text-slate-400"}`}>{when(t.last_message_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

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
