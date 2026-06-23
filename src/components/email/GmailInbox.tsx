"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Mail, RefreshCw, ArrowLeft, ExternalLink, Inbox as InboxIcon, Send, FileText, Layers, AlertTriangle, Trash2, Plus, Loader2, Archive, RotateCcw, CornerUpLeft, Search, Reply, ReplyAll, Forward, Paperclip, ChevronDown, MailOpen } from "lucide-react";
import { EmailBody } from "./EmailBody";
import { ComposeModal } from "./ComposeModal";
import { SenderHeader } from "./SenderHeader";
import { buildPrefill, type ComposeMode, type ComposePrefill } from "@/lib/email/compose-prefill";
import type { EmailAttachment } from "@/lib/email/inbox";
import type { ComposeDraft, Sender } from "./types";

type GmailFolder = "inbox" | "sent" | "all" | "spam" | "trash" | "drafts";
type GmailActionId = "archive" | "spam" | "notspam" | "trash" | "untrash" | "read" | "unread";
type GmailItem = { id: string; threadId: string; from: string; subject: string; date: string; snippet: string; unread: boolean };
type GmailAttachmentRef = { attachmentId: string; messageId: string; filename: string; mimeType: string; size: number };
type GmailMessage = { id: string; from: string; to: string; date: string; subject: string; text: string | null; html: string | null; snippet: string; attachments?: GmailAttachmentRef[] };
type GmailThread = { id: string; subject: string; messages: GmailMessage[] };
type ComposeContext = { mode: ComposeMode; threadId: string | null };

const TLS_SECURITY = "Standard encryption (TLS)";

const FOLDERS: { id: GmailFolder; label: string; icon: typeof Mail }[] = [
  { id: "inbox", label: "Inbox", icon: InboxIcon },
  { id: "sent", label: "Sent", icon: Send },
  { id: "drafts", label: "Drafts", icon: FileText },
  { id: "all", label: "All Mail", icon: Layers },
  { id: "spam", label: "Spam", icon: AlertTriangle },
  { id: "trash", label: "Trash", icon: Trash2 },
];

function fromName(from: string): string {
  const m = from.match(/^\s*"?([^"<]+?)"?\s*</);
  return (m ? m[1] : from).trim();
}
function fromEmail(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return (m ? m[1] : from).trim();
}
function when(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function formatSize(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function GmailInbox() {
  const pathname = usePathname();
  const [folder, setFolder] = useState<GmailFolder>("inbox");
  const [items, setItems] = useState<GmailItem[]>([]);
  const [search, setSearch] = useState("");
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [onlyAttachments, setOnlyAttachments] = useState(false);
  const [dateRange, setDateRange] = useState<"all" | "1d" | "7d" | "30d">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectMenuOpen, setSelectMenuOpen] = useState(false);
  const [connected, setConnected] = useState(true);
  const [needsReadScope, setNeedsReadScope] = useState(false);
  const [readNeedsReconnect, setReadNeedsReconnect] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [thread, setThread] = useState<GmailThread | null>(null);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [counts, setCounts] = useState<{ inbox: number; drafts: number; spam: number }>({ inbox: 0, drafts: 0, spam: 0 });

  const [composeOpen, setComposeOpen] = useState(false);
  const [composePrefill, setComposePrefill] = useState<ComposePrefill | undefined>(undefined);
  const [composeContext, setComposeContext] = useState<ComposeContext>({ mode: "new", threadId: null });
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);

  /** Upload compose attachments to the shared email-attachments bucket; returns stored refs. */
  const uploadComposeFiles = useCallback(async (files: FileList): Promise<EmailAttachment[]> => {
    setUploading(true);
    const out: EmailAttachment[] = [];
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/email/attachments", { method: "POST", body: fd });
        const data = await res.json();
        if (res.ok && data.attachment) out.push(data.attachment);
        else setError(typeof data.error === "string" ? data.error : "Upload failed.");
      }
    } finally {
      setUploading(false);
    }
    return out;
  }, []);

  const connectUrl = `/api/integrations/google/connect?returnTo=${encodeURIComponent(pathname ?? "/admin/inbox")}`;

  /** Gmail folder badge counts (inbox unread, drafts total, spam total). Best-effort. */
  const loadCounts = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/google/gmail/counts");
      const data = await res.json();
      if (res.ok && data.counts) setCounts(data.counts);
    } catch { /* best-effort */ }
  }, []);

  // Filter chips → a Gmail search query, applied server-side.
  const gmailQuery = useMemo(() => {
    const parts: string[] = [];
    if (onlyUnread) parts.push("is:unread");
    if (onlyAttachments) parts.push("has:attachment");
    if (dateRange !== "all") parts.push(`newer_than:${dateRange}`);
    return parts.join(" ");
  }, [onlyUnread, onlyAttachments, dateRange]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    void loadCounts();
    try {
      const qs = gmailQuery ? `&q=${encodeURIComponent(gmailQuery)}` : "";
      const res = await fetch(`/api/integrations/google/gmail/threads?folder=${folder}${qs}`);
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
  }, [folder, loadCounts, gmailQuery]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  // Keep Gmail badges fresh while the view is open.
  useEffect(() => {
    const id = setInterval(() => { void loadCounts(); }, 60000);
    return () => clearInterval(id);
  }, [loadCounts]);

  const selectFolder = useCallback((f: GmailFolder) => {
    setFolder(f); setThread(null); setSearch(""); setOpenCardId(null);
    setSelected(new Set()); setOnlyUnread(false); setOnlyAttachments(false); setDateRange("all");
  }, []);

  const toggleSelect = useCallback((threadId: string) => {
    setSelected((prev) => { const n = new Set(prev); if (n.has(threadId)) n.delete(threadId); else n.add(threadId); return n; });
  }, []);

  const runBulk = useCallback(async (action: GmailActionId) => {
    const ids = [...selected];
    if (ids.length === 0) return;
    setSelected(new Set());
    if (action !== "read" && action !== "unread") setItems((prev) => prev.filter((t) => !ids.includes(t.threadId)));
    const results = await Promise.allSettled(ids.map((id) =>
      fetch(`/api/integrations/google/gmail/threads/${id}/actions`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
      }).then(async (r) => { if (!r.ok) { const d = await r.json().catch(() => ({})); if (d?.needsReconnect) setReadNeedsReconnect(true); throw new Error(); } }),
    ));
    if (results.some((r) => r.status === "rejected")) void load();
    void loadCounts();
  }, [selected, load, loadCounts]);

  const openThread = useCallback(async (threadId: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/integrations/google/gmail/threads/${threadId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to open.");
      setThread(data.thread);
      setOpenCardId(null);
      // Mark the thread read. Optimistically un-bold the row AND drop the Inbox
      // badge by one immediately (Gmail's own label count lags a few seconds).
      let wasUnread = false;
      setItems((prev) => prev.map((t) => {
        if (t.threadId === threadId && t.unread) { wasUnread = true; return { ...t, unread: false }; }
        return t;
      }));
      if (wasUnread) setCounts((c) => ({ ...c, inbox: Math.max(0, c.inbox - 1) }));
      // Clear Gmail's UNREAD label (needs gmail.modify). Best-effort.
      void (async () => {
        try {
          const r = await fetch(`/api/integrations/google/gmail/threads/${threadId}/actions`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "read" }),
          });
          if (r.ok) {
            setReadNeedsReconnect(false);
          } else {
            const d = await r.json().catch(() => ({}));
            // Server couldn't persist the read — undo the optimistic badge drop.
            if (wasUnread) setCounts((c) => ({ ...c, inbox: c.inbox + 1 }));
            if (d?.needsReconnect) setReadNeedsReconnect(true);
          }
        } catch {
          if (wasUnread) setCounts((c) => ({ ...c, inbox: c.inbox + 1 }));
        }
      })();
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

  // ── Compose seam (F3) ──────────────────────────────────────────────────────
  const openCompose = useCallback((prefill?: ComposePrefill, ctx?: ComposeContext) => {
    setError(null);
    setNotice(null);
    setComposeContext(ctx ?? { mode: prefill?.mode ?? "new", threadId: null });
    setComposePrefill(prefill ?? buildPrefill({ mode: "new" }));
    setComposeOpen(true);
  }, []);
  const closeCompose = useCallback(() => { setComposeOpen(false); setComposePrefill(undefined); }, []);

  const onSend = useCallback(async (draft: ComposeDraft) => {
    const inThread = (composeContext.mode === "reply" || composeContext.mode === "replyAll") && composeContext.threadId;
    if (inThread) {
      if (!draft.body.trim()) { setError("Message is required."); return; }
      setSending(true);
      setError(null);
      try {
        const res = await fetch(`/api/integrations/google/gmail/threads/${composeContext.threadId}/reply`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: draft.body }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Reply failed.");
        closeCompose();
        if (composeContext.threadId) await openThread(composeContext.threadId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Reply failed.");
      } finally {
        setSending(false);
      }
      return;
    }
    if (!draft.to.trim() || !draft.subject.trim() || !draft.body.trim()) { setError("To, subject and message are required."); return; }
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/google/gmail/send", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: draft.to.trim(), subject: draft.subject.trim(), body: draft.body, attachments: draft.attachments }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed.");
      closeCompose();
      if (folder === "sent") void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed.");
    } finally {
      setSending(false);
    }
  }, [composeContext, folder, load, openThread, closeCompose]);

  // Reply / Reply all / Forward → wide modal (replies route in-thread).
  const recipientsOf = useCallback((): string[] => {
    if (!thread) return [];
    return thread.messages.flatMap((m) => [fromEmail(m.from), ...m.to.split(",").map((s) => fromEmail(s))]).filter(Boolean);
  }, [thread]);

  const lastMsg = thread?.messages[thread.messages.length - 1];

  const startReply = useCallback(() => {
    if (!thread || !lastMsg) return;
    openCompose(buildPrefill({ mode: "reply", sender: fromEmail(lastMsg.from), subject: thread.subject }), { mode: "reply", threadId: thread.id });
  }, [thread, lastMsg, openCompose]);

  const startReplyAll = useCallback(() => {
    if (!thread || !lastMsg) return;
    openCompose(buildPrefill({ mode: "replyAll", sender: fromEmail(lastMsg.from), recipients: recipientsOf(), subject: thread.subject }), { mode: "replyAll", threadId: thread.id });
  }, [thread, lastMsg, recipientsOf, openCompose]);

  const startForward = useCallback(() => {
    if (!thread || !lastMsg) return;
    openCompose(
      buildPrefill({ mode: "forward", sender: fromEmail(lastMsg.from), subject: thread.subject, body: lastMsg.text || lastMsg.snippet, date: lastMsg.date }),
      { mode: "forward", threadId: null },
    );
  }, [thread, lastMsg, openCompose]);

  const onCardEmail = useCallback((s: Sender) => {
    setOpenCardId(null);
    openCompose(buildPrefill({ mode: "new", sender: s.email }));
  }, [openCompose]);

  const onCardAddContact = useCallback((s: Sender) => {
    setOpenCardId(null);
    try { void navigator.clipboard?.writeText(s.email); } catch { /* ignore */ }
    setNotice(`Copied ${s.email} — add it in your CRM.`);
  }, []);

  const send = useCallback(() => openCompose(), [openCompose]);

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
          <button type="button" onClick={send} className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"><Plus className="h-4 w-4" /> Compose</button>
        </div>
      </div>

      {error && !composeOpen ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
      {notice ? <p className="rounded-lg border border-[#B5D4F4] bg-[#E6F1FB] px-3 py-2 text-sm text-[#0C447C]">{notice}</p> : null}
      {readNeedsReconnect ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#B5D4F4] bg-[#E6F1FB] px-3 py-2 text-sm text-[#0C447C]">
          <span>Reconnect Google to let CapitalOS mark Gmail messages as read.</span>
          <a href={connectUrl} className="inline-flex items-center gap-1.5 rounded-lg bg-[#2f6cb0] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#234f86]">
            <ExternalLink className="h-3.5 w-3.5" /> Reconnect Google
          </a>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[156px_minmax(0,1fr)]">
        <aside>
          <nav className="space-y-0.5">
            {FOLDERS.map((f) => {
              const Icon = f.icon;
              const active = folder === f.id;
              const rawCount = f.id === "inbox" ? counts.inbox : f.id === "drafts" ? counts.drafts : f.id === "spam" ? counts.spam : 0;
              const badge = rawCount > 99 ? "99+" : String(rawCount);
              // Inbox unread reads as emphasis (navy); drafts/spam are muted tallies.
              const badgeClass = f.id === "inbox" ? "bg-[#185FA5] text-white" : "bg-slate-100 text-slate-500";
              return (
                <button key={f.id} type="button" onClick={() => selectFolder(f.id)} className={`flex w-full items-center gap-2.5 rounded-full px-3 py-2 text-sm ${active ? "bg-[#E6F1FB] font-medium text-[#0C447C]" : "text-slate-600 hover:bg-slate-100"}`}>
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="flex-1 text-left">{f.label}</span>
                  {rawCount > 0 ? (
                    <span className={`inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 text-[11px] font-medium leading-5 ${badgeClass}`}>{badge}</span>
                  ) : null}
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
                  <button type="button" onClick={() => { setThread(null); setOpenCardId(null); }} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Back"><ArrowLeft className="h-4 w-4" /></button>
                  <p className="truncate text-sm font-semibold text-slate-950">{thread.subject}</p>
                </div>
                <button type="button" onClick={() => void act(thread.id, "trash")} className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-400 hover:border-[#F7C1C1] hover:bg-[#FCEBEB] hover:text-[#A32D2D]" aria-label="Trash"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="max-h-[460px] space-y-4 overflow-y-auto px-5 py-4">
                {thread.messages.map((m) => (
                  <div key={m.id} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <SenderHeader
                        sender={{ name: fromName(m.from), email: fromEmail(m.from) }}
                        date={m.date}
                        security={TLS_SECURITY}
                        open={openCardId === m.id}
                        onToggle={() => setOpenCardId((cur) => (cur === m.id ? null : m.id))}
                        onClose={() => setOpenCardId(null)}
                        onEmail={onCardEmail}
                        onAddContact={onCardAddContact}
                      />
                      <span className="shrink-0 text-xs text-slate-400">{when(m.date)}</span>
                    </div>
                    <div className="mt-2"><EmailBody html={m.html} text={m.text || m.snippet} /></div>
                    {m.attachments && m.attachments.length > 0 ? (
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {m.attachments.map((a) => (
                          <a
                            key={a.attachmentId}
                            href={`/api/integrations/google/gmail/attachments?messageId=${encodeURIComponent(a.messageId)}&attachmentId=${encodeURIComponent(a.attachmentId)}&filename=${encodeURIComponent(a.filename)}&mimeType=${encodeURIComponent(a.mimeType)}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50"
                          >
                            <Paperclip className="h-3.5 w-3.5 text-slate-400" /> {a.filename}
                            {a.size ? <span className="text-slate-400">{formatSize(a.size)}</span> : null}
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-100 p-3">
                <div className="mb-2 flex flex-wrap gap-2">
                  <button type="button" onClick={startReply} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"><Reply className="h-3.5 w-3.5" /> Reply</button>
                  <button type="button" onClick={startReplyAll} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"><ReplyAll className="h-3.5 w-3.5" /> Reply all</button>
                  <button type="button" onClick={startForward} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"><Forward className="h-3.5 w-3.5" /> Forward</button>
                </div>
                <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={3} placeholder="Quick reply…" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[var(--blue)] focus:outline-none" />
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

              {selected.size > 0 ? (
                <div className="mb-2 flex flex-wrap items-center gap-3 rounded-lg bg-[#E6F1FB] px-3 py-2 text-[#0C447C]">
                  <span className="text-xs font-semibold">{selected.size} selected</span>
                  {folder !== "trash" && folder !== "spam" ? (
                    <>
                      <button type="button" onClick={() => void runBulk("read")} className="inline-flex items-center gap-1 text-xs hover:underline"><MailOpen className="h-3.5 w-3.5" /> Mark read</button>
                      <button type="button" onClick={() => void runBulk("unread")} className="inline-flex items-center gap-1 text-xs hover:underline"><Mail className="h-3.5 w-3.5" /> Unread</button>
                      <button type="button" onClick={() => void runBulk("spam")} className="inline-flex items-center gap-1 text-xs hover:underline"><AlertTriangle className="h-3.5 w-3.5" /> Spam</button>
                    </>
                  ) : null}
                  <button type="button" onClick={() => void runBulk("trash")} className="inline-flex items-center gap-1 text-xs hover:underline"><Trash2 className="h-3.5 w-3.5" /> Trash</button>
                  <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-xs text-slate-500 hover:underline">Clear</button>
                </div>
              ) : (
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <button type="button" onClick={() => setSelectMenuOpen((v) => !v)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
                      <input type="checkbox" readOnly checked={false} className="h-3.5 w-3.5" aria-label="Select" /> <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    {selectMenuOpen ? (
                      <div className="absolute left-0 top-full z-10 mt-1 w-32 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                        {(["all", "none", "read", "unread"] as const).map((m) => (
                          <button key={m} type="button" onClick={() => { setSelectMenuOpen(false); setSelected(m === "none" ? new Set() : new Set(filtered.filter((t) => m === "all" || (m === "unread" ? t.unread : !t.unread)).map((t) => t.threadId))); }} className="block w-full px-3 py-1.5 text-left text-xs capitalize text-slate-700 hover:bg-slate-100">{m}</button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <button type="button" onClick={() => setOnlyUnread((v) => !v)} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs ${onlyUnread ? "border-[#185FA5] bg-[#E6F1FB] text-[#0C447C]" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}><MailOpen className="h-3.5 w-3.5" /> Unread</button>
                  <button type="button" onClick={() => setOnlyAttachments((v) => !v)} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs ${onlyAttachments ? "border-[#185FA5] bg-[#E6F1FB] text-[#0C447C]" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}><Paperclip className="h-3.5 w-3.5" /> Has attachment</button>
                  <select value={dateRange} onChange={(e) => setDateRange(e.target.value as typeof dateRange)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 focus:outline-none">
                    <option value="all">Any time</option>
                    <option value="1d">Today</option>
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                  </select>
                </div>
              )}

              <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)]">
                {loading ? (
                  <p className="px-4 py-8 text-sm text-slate-400">Loading your Gmail…</p>
                ) : filtered.length === 0 ? (
                  <p className="px-4 py-10 text-center text-sm text-slate-400">{search ? `No mail matches “${search}”.` : `Nothing in ${FOLDERS.find((f) => f.id === folder)?.label}.`}</p>
                ) : (
                  <ul>
                    {filtered.map((t) => (
                      <li key={t.threadId} role="button" tabIndex={0} onClick={() => void openThread(t.threadId)} onKeyDown={(e) => { if (e.key === "Enter") void openThread(t.threadId); }}
                        className={`group flex cursor-pointer items-center gap-3 border-b border-slate-100 px-4 py-2.5 last:border-0 ${selected.has(t.threadId) ? "bg-[#E6F1FB]" : t.unread ? "bg-white hover:bg-slate-50" : "bg-slate-50/40 hover:bg-slate-50"}`}>
                        <input type="checkbox" checked={selected.has(t.threadId)} onClick={(e) => e.stopPropagation()} onChange={() => toggleSelect(t.threadId)} className="h-3.5 w-3.5 shrink-0" aria-label="Select conversation" />
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

      {/* F3 wide compose modal (Gmail) */}
      <ComposeModal
        open={composeOpen}
        prefill={composePrefill}
        title={composeContext.mode === "forward" ? "Forward · Gmail" : composeContext.mode === "reply" || composeContext.mode === "replyAll" ? "Reply · Gmail" : "New message · Gmail"}
        sending={sending}
        error={composeOpen ? error : null}
        onSend={(d) => void onSend(d)}
        onClose={closeCompose}
        uploadFiles={uploadComposeFiles}
        uploading={uploading}
      />
    </div>
  );
}
