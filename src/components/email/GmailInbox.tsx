"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Mail, RefreshCw, ArrowLeft, ExternalLink, Inbox as InboxIcon, Send, FileText, Layers, AlertTriangle, Trash2, Plus, X, Loader2, Archive, RotateCcw, CornerUpLeft, Search } from "lucide-react";

type GmailFolder = "inbox" | "sent" | "all" | "spam" | "trash" | "drafts";
type GmailActionId = "archive" | "spam" | "notspam" | "trash" | "untrash";
type GmailItem = { id: string; threadId: string; from: string; subject: string; date: string; snippet: string; unread: boolean };
type GmailMessage = { id: string; from: string; to: string; date: string; subject: string; text: string | null; html: string | null; snippet: string };
type GmailThread = { id: string; subject: string; messages: GmailMessage[] };

const FOLDERS: { id: GmailFolder; label: string; icon: typeof Mail }[] = [
  { id: "inbox", label: "Inbox", icon: InboxIcon },
  { id: "sent", label: "Sent", icon: Send },
  { id: "drafts", label: "Drafts", icon: FileText },
  { id: "all", label: "All Mail", icon: Layers },
  { id: "spam", label: "Spam", icon: AlertTriangle },
  { id: "trash", label: "Trash", icon: Trash2 },
];

function stripHtml(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/[ \t]{2,}/g, " ").trim();
}
function fromName(from: string): string {
  const m = from.match(/^\s*"?([^"<]+?)"?\s*</);
  return (m ? m[1] : from).trim();
}
function when(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function GmailInbox() {
  const pathname = usePathname();
  const [folder, setFolder] = useState<GmailFolder>("inbox");
  const [items, setItems] = useState<GmailItem[]>([]);
  const [search, setSearch] = useState("");
  const [connected, setConnected] = useState(true);
  const [needsReadScope, setNeedsReadScope] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [thread, setThread] = useState<GmailThread | null>(null);

  const [composeOpen, setComposeOpen] = useState(false);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);

  const connectUrl = `/api/integrations/google/connect?returnTo=${encodeURIComponent(pathname ?? "/admin/inbox")}`;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/integrations/google/gmail/threads?folder=${folder}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load Gmail.");
      setConnected(data.connected);
      setNeedsReadScope(Boolean(data.needsReadScope));
      setItems(data.threads ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Gmail.");
    } finally {
      setLoading(false);
    }
  }, [folder]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const selectFolder = useCallback((f: GmailFolder) => { setFolder(f); setThread(null); setSearch(""); }, []);

  const openThread = useCallback(async (threadId: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/integrations/google/gmail/threads/${threadId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to open.");
      setThread(data.thread);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open.");
    }
  }, []);

  const act = useCallback(async (threadId: string, action: GmailActionId) => {
    setItems((prev) => prev.filter((t) => t.threadId !== threadId));
    if (thread?.id === threadId) setThread(null);
    try {
      const res = await fetch(`/api/integrations/google/gmail/threads/${threadId}/actions`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? "Action failed."); }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
      void load();
    }
  }, [thread, load]);

  const sendReply = useCallback(async () => {
    if (!thread || !replyText.trim()) return;
    setReplying(true);
    setError(null);
    try {
      const res = await fetch(`/api/integrations/google/gmail/threads/${thread.id}/reply`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: replyText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Reply failed.");
      setReplyText("");
      await openThread(thread.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reply failed.");
    } finally {
      setReplying(false);
    }
  }, [thread, replyText, openThread]);

  const send = useCallback(async () => {
    if (!to.trim() || !subject.trim() || !body.trim()) { setError("To, subject and message are required."); return; }
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/google/gmail/send", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: to.trim(), subject: subject.trim(), body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed.");
      setComposeOpen(false); setTo(""); setSubject(""); setBody("");
      if (folder === "sent") void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed.");
    } finally {
      setSending(false);
    }
  }, [to, subject, body, folder, load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((t) => fromName(t.from).toLowerCase().includes(q) || t.subject.toLowerCase().includes(q) || t.snippet.toLowerCase().includes(q));
  }, [items, search]);

  if (!connected || needsReadScope) {
    return (
      <div className="rounded-xl border border-[#B5D4F4] bg-[#E6F1FB] p-6 text-center">
        <Mail className="mx-auto h-7 w-7 text-[#2f6cb0]" strokeWidth={1.5} />
        <h2 className="mt-2 text-base font-semibold text-[#0C447C]">{connected ? "Grant inbox access" : "Connect your Google account"}</h2>
        <p className="mt-1 text-sm text-[#234f86]">{connected ? "Reconnect Google to allow CapitalOS to read your Gmail inbox." : "Connect Google to read your real email here."}</p>
        <a href={connectUrl} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#2f6cb0] px-4 py-2 text-sm font-semibold text-white hover:bg-[#234f86]">
          <ExternalLink className="h-4 w-4" /> {connected ? "Reconnect Google" : "Connect Google"}
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-950">
          <Mail className="h-6 w-6 text-[var(--gold)]" strokeWidth={1.75} aria-hidden /> Inbox
        </h1>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void load()} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" aria-label="Refresh"><RefreshCw className="h-4 w-4" /></button>
          <button type="button" onClick={() => { setError(null); setComposeOpen(true); }} className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"><Plus className="h-4 w-4" /> Compose</button>
        </div>
      </div>

      {error && !composeOpen ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[156px_minmax(0,1fr)]">
        <aside>
          <nav className="space-y-0.5">
            {FOLDERS.map((f) => {
              const Icon = f.icon;
              const active = folder === f.id;
              return (
                <button key={f.id} type="button" onClick={() => selectFolder(f.id)} className={`flex w-full items-center gap-2.5 rounded-full px-3 py-2 text-sm ${active ? "bg-[#E6F1FB] font-medium text-[#0C447C]" : "text-slate-600 hover:bg-slate-100"}`}>
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="flex-1 text-left">{f.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 space-y-3">
          {thread ? (
            <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)]">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <button type="button" onClick={() => setThread(null)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Back"><ArrowLeft className="h-4 w-4" /></button>
                  <p className="truncate text-sm font-semibold text-slate-950">{thread.subject}</p>
                </div>
                <button type="button" onClick={() => void act(thread.id, "trash")} className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-400 hover:border-[#F7C1C1] hover:bg-[#FCEBEB] hover:text-[#A32D2D]" aria-label="Trash"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="max-h-[460px] space-y-4 overflow-y-auto px-5 py-4">
                {thread.messages.map((m) => (
                  <div key={m.id} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-medium text-slate-900">{fromName(m.from)}</p>
                      <span className="shrink-0 text-xs text-slate-400">{when(m.date)}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">{m.text || (m.html ? stripHtml(m.html) : m.snippet)}</p>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-100 p-3">
                <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={3} placeholder="Reply…" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[var(--blue)] focus:outline-none" />
                <div className="mt-2 flex justify-end">
                  <button type="button" onClick={() => void sendReply()} disabled={replying || !replyText.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">{replying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CornerUpLeft className="h-4 w-4" />} {replying ? "Sending…" : "Reply"}</button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2">
                <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search mail" className="w-full bg-transparent text-sm focus:outline-none" />
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)]">
                {loading ? (
                  <p className="px-4 py-8 text-sm text-slate-400">Loading your Gmail…</p>
                ) : filtered.length === 0 ? (
                  <p className="px-4 py-10 text-center text-sm text-slate-400">{search ? `No mail matches “${search}”.` : `Nothing in ${FOLDERS.find((f) => f.id === folder)?.label}.`}</p>
                ) : (
                  <ul>
                    {filtered.map((t) => (
                      <li key={t.threadId} role="button" tabIndex={0} onClick={() => void openThread(t.threadId)} onKeyDown={(e) => { if (e.key === "Enter") void openThread(t.threadId); }}
                        className={`group flex cursor-pointer items-center gap-3 border-b border-slate-100 px-4 py-2.5 last:border-0 ${t.unread ? "bg-white hover:bg-slate-50" : "bg-slate-50/40 hover:bg-slate-50"}`}>
                        <span className={`w-44 shrink-0 truncate text-sm ${t.unread ? "font-semibold text-slate-950" : "text-slate-600"}`}>{fromName(t.from)}</span>
                        <span className="min-w-0 flex-1 truncate text-sm">
                          <span className={t.unread ? "font-semibold text-slate-950" : "text-slate-700"}>{t.subject}</span>
                          {t.snippet ? <span className="text-slate-400"> — {t.snippet}</span> : null}
                        </span>
                        <span className="hidden shrink-0 items-center gap-1 group-hover:flex">
                          {folder === "trash" ? (
                            <button type="button" title="Restore to inbox" onClick={(e) => { e.stopPropagation(); void act(t.threadId, "untrash"); }} className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-[#185FA5]"><RotateCcw className="h-4 w-4" /></button>
                          ) : folder === "spam" ? (
                            <button type="button" title="Not spam" onClick={(e) => { e.stopPropagation(); void act(t.threadId, "notspam"); }} className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-[#185FA5]"><RotateCcw className="h-4 w-4" /></button>
                          ) : (
                            <>
                              <button type="button" title="Archive" onClick={(e) => { e.stopPropagation(); void act(t.threadId, "archive"); }} className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"><Archive className="h-4 w-4" /></button>
                              <button type="button" title="Report spam" onClick={(e) => { e.stopPropagation(); void act(t.threadId, "spam"); }} className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-[#B06A00]"><AlertTriangle className="h-4 w-4" /></button>
                              <button type="button" title="Move to Trash" onClick={(e) => { e.stopPropagation(); void act(t.threadId, "trash"); }} className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-[#A32D2D]"><Trash2 className="h-4 w-4" /></button>
                            </>
                          )}
                        </span>
                        <span className={`w-16 shrink-0 text-right text-xs group-hover:hidden ${t.unread ? "font-semibold text-slate-900" : "text-slate-400"}`}>{when(t.date)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {composeOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <h2 className="text-sm font-semibold text-slate-900">New message · Gmail</h2>
              <button type="button" onClick={() => setComposeOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3 px-5 py-4">
              {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p> : null}
              <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="To" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} placeholder="Write your message…" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3">
              <button type="button" onClick={() => setComposeOpen(false)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={() => void send()} disabled={sending} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {sending ? "Sending…" : "Send"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
