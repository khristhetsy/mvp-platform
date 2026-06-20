"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Mail, Send, Plus, X, RefreshCw, Trash2, MailOpen, ArrowLeft, Search, Inbox as InboxIcon, FileText, Layers, AlertTriangle, RotateCcw, Paperclip } from "lucide-react";
import type { ThreadListItem, EmailMessage, MailFolder, EmailAttachment } from "@/lib/email/inbox";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const FOLDERS: Array<{ id: MailFolder | "drafts" | "spam"; label: string; icon: typeof Mail; soon?: boolean }> = [
  { id: "inbox", label: "Inbox", icon: InboxIcon },
  { id: "sent", label: "Sent", icon: Send },
  { id: "drafts", label: "Drafts", icon: FileText, soon: true },
  { id: "all", label: "All Mail", icon: Layers },
  { id: "spam", label: "Spam", icon: AlertTriangle, soon: true },
  { id: "trash", label: "Trash", icon: Trash2 },
];

function when(ts: string): string {
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (d.getFullYear() === today.getFullYear()) return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}

function initials(name: string): string {
  return name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? "").join("") || "?";
}

type ActiveThread = { id: string; subject: string | null; contact_email: string; contact_name: string | null };

export function EmailInbox() {
  const [threads, setThreads] = useState<ThreadListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [folder, setFolder] = useState<MailFolder>("inbox");

  const [active, setActive] = useState<ActiveThread | null>(null);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const [composeOpen, setComposeOpen] = useState(false);
  const [compose, setCompose] = useState({ to: "", subject: "", body: "" });
  const [composeFiles, setComposeFiles] = useState<EmailAttachment[]>([]);
  const [replyFiles, setReplyFiles] = useState<EmailAttachment[]>([]);
  const [uploading, setUploading] = useState(false);

  const uploadFiles = useCallback(async (files: FileList | null, target: "compose" | "reply") => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/email/attachments", { method: "POST", body: fd });
        const data = await res.json();
        if (res.ok && data.attachment) {
          if (target === "compose") setComposeFiles((p) => [...p, data.attachment]);
          else setReplyFiles((p) => [...p, data.attachment]);
        } else {
          setError(typeof data.error === "string" ? data.error : "Upload failed.");
        }
      }
    } finally {
      setUploading(false);
    }
  }, []);

  const loadThreads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/email/threads?folder=${folder}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load.");
      setThreads(data.threads ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [folder]);

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

  const purgeThread = useCallback(async (id: string) => {
    setThreads((prev) => prev.filter((t) => t.id !== id));
    if (active?.id === id) { setActive(null); setMessages([]); }
    try {
      await fetch(`/api/email/threads/${id}?purge=true`, { method: "DELETE" });
    } catch {
      void loadThreads();
    }
  }, [active, loadThreads]);

  const restoreThread = useCallback(async (id: string) => {
    setThreads((prev) => prev.filter((t) => t.id !== id));
    if (active?.id === id) { setActive(null); setMessages([]); }
    try {
      await fetch(`/api/email/threads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trashed: false }) });
    } catch {
      void loadThreads();
    }
  }, [active, loadThreads]);

  const forward = useCallback(() => {
    if (!active) return;
    const last = messages[messages.length - 1];
    const quoted = last
      ? `\n\n---------- Forwarded message ----------\nFrom: ${last.from_email}\nSubject: ${active.subject ?? ""}\n\n${last.body_text ?? ""}`
      : "";
    setError(null);
    setCompose({ to: "", subject: `Fwd: ${active.subject ?? ""}`.trim(), body: quoted });
    setComposeOpen(true);
  }, [active, messages]);

  const selectFolder = useCallback((f: MailFolder) => {
    setFolder(f);
    setActive(null);
    setMessages([]);
    setSearch("");
  }, []);

  const sendReply = useCallback(async () => {
    if (!active || !reply.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/email/threads/${active.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply, attachments: replyFiles }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Reply failed.");
      setMessages(data.messages ?? []);
      setReply("");
      setReplyFiles([]);
      await loadThreads();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reply failed.");
    } finally {
      setSending(false);
    }
  }, [active, reply, replyFiles, loadThreads]);

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
        body: JSON.stringify({ ...compose, attachments: composeFiles }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Send failed.");
      setComposeOpen(false);
      setCompose({ to: "", subject: "", body: "" });
      setComposeFiles([]);
      await loadThreads();
      if (data.thread?.id) await openThread(data.thread.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed.");
    } finally {
      setSending(false);
    }
  }, [compose, composeFiles, loadThreads, openThread]);

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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[156px_minmax(0,1fr)]">
        <aside>
          <nav className="space-y-0.5">
            {FOLDERS.map((f) => {
              const Icon = f.icon;
              const isActive = !f.soon && folder === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  disabled={f.soon}
                  onClick={() => { if (!f.soon) selectFolder(f.id as MailFolder); }}
                  className={`flex w-full items-center gap-2.5 rounded-full px-3 py-2 text-sm ${isActive ? "bg-[#E6F1FB] font-medium text-[#0C447C]" : f.soon ? "cursor-not-allowed text-slate-300" : "text-slate-600 hover:bg-slate-100"}`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="flex-1 text-left">{f.label}</span>
                  {f.id === "inbox" && unreadCount > 0 ? <span className="text-[11px]">{unreadCount}</span> : null}
                  {f.soon ? <span className="rounded border border-slate-200 px-1 text-[9px]">soon</span> : null}
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 space-y-3">
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
          <div className="max-h-[460px] space-y-5 overflow-y-auto px-5 py-4">
            {messages.map((m) => {
              const senderName = m.direction === "outbound" ? "You" : (m.from_name ?? m.from_email);
              return (
                <div key={m.id} className="flex gap-3 border-b border-slate-100 pb-5 last:border-0 last:pb-0">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E6F1FB] text-xs font-semibold text-[#0C447C]">{initials(senderName)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm"><span className="font-semibold text-slate-900">{senderName}</span> <span className="text-xs text-slate-400">&lt;{m.from_email}&gt;</span></p>
                      <span className="shrink-0 text-xs text-slate-400">{new Date(m.created_at).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                    </div>
                    <p className="text-[11px] text-slate-400">to {m.to_email}</p>
                    <p className="mt-2.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{m.body_text ?? ""}</p>
                    {m.attachments && m.attachments.length > 0 ? (
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {m.attachments.map((a) => (
                          <a key={a.path} href={`/api/email/attachments/download?path=${encodeURIComponent(a.path)}`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50">
                            <Paperclip className="h-3.5 w-3.5 text-slate-400" /> {a.name} <span className="text-slate-400">{formatSize(a.size)}</span>
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="border-t border-slate-100 p-3">
            <div className="mb-2 flex gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600"><Send className="h-3.5 w-3.5" /> Reply below</span>
              <button type="button" onClick={() => forward()} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"><ArrowLeft className="h-3.5 w-3.5 rotate-180" /> Forward</button>
            </div>
            <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} placeholder="Reply…" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[var(--blue)] focus:outline-none" />
            {replyFiles.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {replyFiles.map((a) => (
                  <span key={a.path} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700">
                    <Paperclip className="h-3.5 w-3.5 text-slate-400" /> {a.name}
                    <button type="button" onClick={() => setReplyFiles((p) => p.filter((x) => x.path !== a.path))} className="text-slate-400 hover:text-slate-700"><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            ) : null}
            <div className="mt-2 flex items-center justify-between">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">
                <Paperclip className="h-3.5 w-3.5" /> {uploading ? "Uploading…" : "Attach"}
                <input type="file" multiple className="hidden" onChange={(e) => { void uploadFiles(e.target.files, "reply"); e.target.value = ""; }} />
              </label>
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
              <p className="px-4 py-10 text-center text-sm text-slate-400">{folder === "trash" ? "Trash is empty." : folder === "sent" ? "No sent mail yet." : "No conversations yet. Compose to start one."}</p>
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
                      {folder === "trash" ? (
                        <>
                          <button type="button" title="Restore" onClick={(e) => { e.stopPropagation(); void restoreThread(t.id); }} className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-[#185FA5]"><RotateCcw className="h-4 w-4" /></button>
                          <button type="button" title="Delete forever" onClick={(e) => { e.stopPropagation(); void purgeThread(t.id); }} className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-[#A32D2D]"><Trash2 className="h-4 w-4" /></button>
                        </>
                      ) : (
                        <>
                          <button type="button" title="Mark unread" onClick={(e) => { e.stopPropagation(); void markUnread(t.id); }} className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"><MailOpen className="h-4 w-4" /></button>
                          <button type="button" title="Move to Trash" onClick={(e) => { e.stopPropagation(); void deleteThread(t.id); }} className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-[#A32D2D]"><Trash2 className="h-4 w-4" /></button>
                        </>
                      )}
                    </span>
                    <span className={`w-16 shrink-0 text-right text-xs group-hover:hidden ${t.unread ? "font-semibold text-slate-900" : "text-slate-400"}`}>{when(t.last_message_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
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
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                  <Paperclip className="h-3.5 w-3.5" /> {uploading ? "Uploading…" : "Attach files"}
                  <input type="file" multiple className="hidden" onChange={(e) => { void uploadFiles(e.target.files, "compose"); e.target.value = ""; }} />
                </label>
                {composeFiles.map((a) => (
                  <span key={a.path} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700">
                    <Paperclip className="h-3.5 w-3.5 text-slate-400" /> {a.name} <span className="text-slate-400">{formatSize(a.size)}</span>
                    <button type="button" onClick={() => setComposeFiles((p) => p.filter((x) => x.path !== a.path))} className="text-slate-400 hover:text-slate-700"><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
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
