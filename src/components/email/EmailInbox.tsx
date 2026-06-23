"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Mail, Send, Plus, X, RefreshCw, Trash2, MailOpen, ArrowLeft, Search, Inbox as InboxIcon, FileText, Layers, AlertTriangle, RotateCcw, Paperclip, Reply, ReplyAll, Forward, ChevronDown } from "lucide-react";
import type { ThreadListItem, EmailMessage, MailFolder, EmailAttachment } from "@/lib/email/inbox";
import type { EmailDraft } from "@/lib/email/drafts";
import { buildPrefill, type ComposeMode, type ComposePrefill } from "@/lib/email/compose-prefill";
import type { ComposeDraft, Sender } from "./types";
import { ComposeModal } from "./ComposeModal";
import { SenderHeader } from "./SenderHeader";
import { EmailBody } from "./EmailBody";
import { ListRowsSkeleton } from "@/components/ui/Skeleton";

type FolderId = MailFolder | "drafts";

/** All platform mail is sent over TLS (Resend) — shown in the contact card. */
const TLS_SECURITY = "Standard encryption (TLS)";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const FOLDERS: Array<{ id: MailFolder | "drafts" | "spam"; label: string; icon: typeof Mail; soon?: boolean }> = [
  { id: "inbox", label: "Inbox", icon: InboxIcon },
  { id: "sent", label: "Sent", icon: Send },
  { id: "drafts", label: "Drafts", icon: FileText },
  { id: "all", label: "All Mail", icon: Layers },
  { id: "spam", label: "Spam", icon: AlertTriangle },
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
/** Where a modal send should route: an in-thread reply (preserves threading) or a new thread. */
type ComposeContext = { mode: ComposeMode; threadId: string | null };

export function EmailInbox() {
  const [threads, setThreads] = useState<ThreadListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [folder, setFolder] = useState<FolderId>("inbox");
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [onlyAttachments, setOnlyAttachments] = useState(false);
  const [dateRange, setDateRange] = useState<"all" | "1d" | "7d" | "30d">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectMenuOpen, setSelectMenuOpen] = useState(false);
  const [drafts, setDrafts] = useState<EmailDraft[]>([]);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [counts, setCounts] = useState<{ inbox: number; drafts: number; spam: number }>({ inbox: 0, drafts: 0, spam: 0 });

  const [active, setActive] = useState<ActiveThread | null>(null);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [openCardId, setOpenCardId] = useState<string | null>(null); // F2: single open card

  // F3 compose modal state
  const [composeOpen, setComposeOpen] = useState(false);
  const [composePrefill, setComposePrefill] = useState<ComposePrefill | undefined>(undefined);
  const [composeInitAttachments, setComposeInitAttachments] = useState<EmailAttachment[]>([]);
  const [composeContext, setComposeContext] = useState<ComposeContext>({ mode: "new", threadId: null });
  const [replyFiles, setReplyFiles] = useState<EmailAttachment[]>([]);
  const [uploading, setUploading] = useState(false);

  /** Upload for the inline quick-reply box. */
  const uploadReplyFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/email/attachments", { method: "POST", body: fd });
        const data = await res.json();
        if (res.ok && data.attachment) setReplyFiles((p) => [...p, data.attachment]);
        else setError(typeof data.error === "string" ? data.error : "Upload failed.");
      }
    } finally {
      setUploading(false);
    }
  }, []);

  /** Upload for the compose modal — returns the stored attachments to the modal. */
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

  const loadDrafts = useCallback(async () => {
    try {
      const res = await fetch("/api/email/drafts");
      const data = await res.json();
      if (res.ok) setDrafts(data.drafts ?? []);
    } catch { /* best-effort */ }
  }, []);

  /** Folder badge counts (inbox unread, drafts total, spam total). Best-effort. */
  const loadCounts = useCallback(async () => {
    try {
      const res = await fetch("/api/email/counts");
      const data = await res.json();
      if (res.ok && data.counts) setCounts(data.counts);
    } catch { /* best-effort */ }
  }, []);

  const loadThreads = useCallback(async () => {
    void loadCounts();
    if (folder === "drafts") { setLoading(true); await loadDrafts(); setLoading(false); return; }
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
  }, [folder, loadDrafts, loadCounts]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadThreads(); }, [loadThreads]);

  // Keep badges fresh while the inbox is open (catches newly-arrived mail).
  useEffect(() => {
    const id = setInterval(() => { void loadCounts(); }, 30000);
    return () => clearInterval(id);
  }, [loadCounts]);

  // ── F3 single compose entry point ─────────────────────────────────────────
  const openCompose = useCallback(
    (prefill?: ComposePrefill, opts?: { context?: ComposeContext; draftId?: string | null; attachments?: EmailAttachment[] }) => {
      setError(null);
      setNotice(null);
      setEditingDraftId(opts?.draftId ?? null);
      setComposeInitAttachments(opts?.attachments ?? []);
      setComposeContext(opts?.context ?? { mode: prefill?.mode ?? "new", threadId: null });
      setComposePrefill(prefill ?? buildPrefill({ mode: "new" }));
      setComposeOpen(true);
    },
    [],
  );

  const closeCompose = useCallback(() => {
    setComposeOpen(false);
    setComposePrefill(undefined);
    setComposeInitAttachments([]);
    setEditingDraftId(null);
  }, []);

  // Deep link: /inbox?to=email&subject=... opens compose prefilled.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const to = params.get("to");
    if (to) openCompose(buildPrefill({ mode: "new", sender: to, subject: params.get("subject") ?? "" }));
  }, [openCompose]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const unreadCount = threads.filter((t) => t.unread).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    // eslint-disable-next-line react-hooks/purity
    const cutoff = dateRange === "all" ? 0 : Date.now() - { "1d": 1, "7d": 7, "30d": 30 }[dateRange] * 86400000;
    return threads.filter((t) => {
      if (onlyUnread && !t.unread) return false;
      if (onlyAttachments && !t.has_attachments) return false;
      if (cutoff && new Date(t.last_message_at).getTime() < cutoff) return false;
      if (q && !(
        (t.contact_name ?? "").toLowerCase().includes(q) ||
        t.contact_email.toLowerCase().includes(q) ||
        (t.subject ?? "").toLowerCase().includes(q) ||
        (t.snippet ?? "").toLowerCase().includes(q)
      )) return false;
      return true;
    });
  }, [threads, search, onlyUnread, onlyAttachments, dateRange]);

  const openThread = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/email/threads/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to open.");
      setActive(data.thread);
      setMessages(data.messages ?? []);
      setOpenCardId(null);
      setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, unread: false } : t)));
      void loadCounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open.");
    }
  }, [loadCounts]);

  const markUnread = useCallback(async (id: string) => {
    setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, unread: true } : t)));
    try {
      await fetch(`/api/email/threads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ unread: true }) });
      void loadCounts();
    } catch { /* best-effort */ }
  }, [loadCounts]);

  const deleteThread = useCallback(async (id: string) => {
    setThreads((prev) => prev.filter((t) => t.id !== id));
    if (active?.id === id) { setActive(null); setMessages([]); }
    try {
      await fetch(`/api/email/threads/${id}`, { method: "DELETE" });
    } catch { void loadThreads(); }
  }, [active, loadThreads]);

  const purgeThread = useCallback(async (id: string) => {
    setThreads((prev) => prev.filter((t) => t.id !== id));
    if (active?.id === id) { setActive(null); setMessages([]); }
    try {
      await fetch(`/api/email/threads/${id}?purge=true`, { method: "DELETE" });
    } catch { void loadThreads(); }
  }, [active, loadThreads]);

  const restoreThread = useCallback(async (id: string) => {
    setThreads((prev) => prev.filter((t) => t.id !== id));
    if (active?.id === id) { setActive(null); setMessages([]); }
    try {
      await fetch(`/api/email/threads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trashed: false }) });
    } catch { void loadThreads(); }
  }, [active, loadThreads]);

  const setSpam = useCallback(async (id: string, spam: boolean) => {
    setThreads((prev) => prev.filter((t) => t.id !== id));
    if (active?.id === id) { setActive(null); setMessages([]); }
    try {
      await fetch(`/api/email/threads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ spam }) });
      void loadCounts();
    } catch { void loadThreads(); }
  }, [active, loadThreads, loadCounts]);

  // ── Reply / Reply all / Forward → open the wide compose modal (F3) ─────────
  const recipientsOf = useCallback((): string[] => {
    const last = messages[messages.length - 1];
    return last ? [last.from_email, last.to_email].filter(Boolean) : [];
  }, [messages]);

  const startReply = useCallback(() => {
    if (!active) return;
    openCompose(buildPrefill({ mode: "reply", sender: active.contact_email, subject: active.subject }), {
      context: { mode: "reply", threadId: active.id },
    });
  }, [active, openCompose]);

  const startReplyAll = useCallback(() => {
    if (!active) return;
    openCompose(buildPrefill({ mode: "replyAll", sender: active.contact_email, recipients: recipientsOf(), subject: active.subject }), {
      context: { mode: "replyAll", threadId: active.id },
    });
  }, [active, recipientsOf, openCompose]);

  const startForward = useCallback(() => {
    if (!active) return;
    const last = messages[messages.length - 1];
    openCompose(
      buildPrefill({ mode: "forward", sender: last?.from_email ?? active.contact_email, subject: active.subject, body: last?.body_text, date: last ? new Date(last.created_at).toLocaleString() : undefined }),
      { context: { mode: "forward", threadId: null } },
    );
  }, [active, messages, openCompose]);

  const selectFolder = useCallback((f: FolderId) => {
    setFolder(f);
    setActive(null);
    setMessages([]);
    setSearch("");
    setOpenCardId(null);
    setSelected(new Set());
    setOnlyUnread(false);
    setOnlyAttachments(false);
    setDateRange("all");
  }, []);

  // ── Selection + bulk actions ──────────────────────────────────────────────
  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }, []);
  const selectBy = useCallback((mode: "all" | "none" | "read" | "unread") => {
    setSelectMenuOpen(false);
    setSelected(() => {
      if (mode === "none") return new Set();
      const ids = filtered.filter((t) => mode === "all" || (mode === "unread" ? t.unread : !t.unread)).map((t) => t.id);
      return new Set(ids);
    });
  }, [filtered]);

  const runBulk = useCallback(async (action: "read" | "unread" | "spam" | "delete") => {
    const ids = [...selected];
    if (ids.length === 0) return;
    setSelected(new Set());
    if (action === "read" || action === "unread") {
      const unread = action === "unread";
      setThreads((prev) => prev.map((t) => (selected.has(t.id) ? { ...t, unread } : t)));
    } else {
      setThreads((prev) => prev.filter((t) => !selected.has(t.id)));
    }
    await Promise.allSettled(ids.map((id) => {
      if (action === "delete") return fetch(`/api/email/threads/${id}`, { method: "DELETE" });
      const body = action === "spam" ? { spam: true } : { unread: action === "unread" };
      return fetch(`/api/email/threads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    }));
    void loadCounts();
    if (action === "spam" || action === "delete") void loadThreads();
  }, [selected, loadCounts, loadThreads]);

  // ── Compose modal send / save-draft ───────────────────────────────────────
  const onSaveDraft = useCallback(async (draft: ComposeDraft) => {
    try {
      const res = await fetch("/api/email/drafts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingDraftId, to: draft.to, subject: draft.subject, body: draft.body, attachments: draft.attachments }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save draft.");
      closeCompose();
      void loadDrafts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save draft.");
    }
  }, [editingDraftId, loadDrafts, closeCompose]);

  const onSendCompose = useCallback(async (draft: ComposeDraft) => {
    const inThread = (composeContext.mode === "reply" || composeContext.mode === "replyAll") && composeContext.threadId;
    if (inThread) {
      // Preserve threading: reply within the existing thread.
      if (!draft.body.trim()) { setError("Message is required."); return; }
      setSending(true);
      try {
        const res = await fetch(`/api/email/threads/${composeContext.threadId}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: draft.body, attachments: draft.attachments }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Reply failed.");
        setMessages(data.messages ?? []);
        closeCompose();
        await loadThreads();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Reply failed.");
      } finally {
        setSending(false);
      }
      return;
    }

    // New thread (Compose / Forward / Email-from-card).
    if (!draft.to.trim() || !draft.subject.trim() || !draft.body.trim()) {
      setError("To, subject and message are required.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/email/threads", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: draft.to, cc: draft.cc, bcc: draft.bcc, subject: draft.subject, body: draft.body, attachments: draft.attachments }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Send failed.");
      const wasDraft = editingDraftId;
      closeCompose();
      if (wasDraft) {
        try { await fetch("/api/email/drafts", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: wasDraft }) }); } catch { /* best-effort */ }
        void loadDrafts();
      }
      await loadThreads();
      if (data.thread?.id) await openThread(data.thread.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed.");
    } finally {
      setSending(false);
    }
  }, [composeContext, editingDraftId, loadThreads, loadDrafts, openThread, closeCompose]);

  const openDraft = useCallback((d: EmailDraft) => {
    openCompose(buildPrefill({ mode: "new", sender: d.to_email ?? "", subject: d.subject ?? "", body: d.body ?? "" }), {
      draftId: d.id,
      attachments: d.attachments ?? [],
    });
  }, [openCompose]);

  const discardDraft = useCallback(async (id: string) => {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    try { await fetch("/api/email/drafts", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }); void loadCounts(); } catch { void loadDrafts(); }
  }, [loadDrafts, loadCounts]);

  const sendReply = useCallback(async () => {
    if (!active || !reply.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/email/threads/${active.id}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
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

  // ── F2 contact-card actions ───────────────────────────────────────────────
  const onCardEmail = useCallback((s: Sender) => {
    setOpenCardId(null);
    openCompose(buildPrefill({ mode: "new", sender: s.email }));
  }, [openCompose]);

  const onCardAddContact = useCallback((s: Sender) => {
    setOpenCardId(null);
    // No admin contacts store exists yet (out of scope: storage). Copy the address
    // so the user can add it in their CRM, and confirm inline.
    try { void navigator.clipboard?.writeText(s.email); } catch { /* ignore */ }
    setNotice(`Copied ${s.email} — add it in your CRM.`);
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-950">
          <Mail className="h-6 w-6 text-[var(--gold)]" strokeWidth={1.75} aria-hidden /> Inbox
          {unreadCount > 0 ? <span className="text-sm font-normal text-slate-400">{unreadCount} unread</span> : null}
        </h1>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void loadThreads()} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" aria-label="Refresh"><RefreshCw className="h-4 w-4" /></button>
          <button type="button" onClick={() => openCompose()} className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"><Plus className="h-4 w-4" /> Compose</button>
        </div>
      </div>

      {error && !composeOpen ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
      {notice ? <p className="rounded-lg border border-[#B5D4F4] bg-[#E6F1FB] px-3 py-2 text-sm text-[#0C447C]">{notice}</p> : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[156px_minmax(0,1fr)]">
        <aside>
          <nav className="space-y-0.5">
            {FOLDERS.map((f) => {
              const Icon = f.icon;
              const isActive = !f.soon && folder === f.id;
              const rawCount = f.id === "inbox" ? counts.inbox : f.id === "drafts" ? counts.drafts : f.id === "spam" ? counts.spam : 0;
              const badge = rawCount > 99 ? "99+" : String(rawCount);
              // Inbox unread reads as emphasis (navy); drafts/spam are muted tallies.
              const badgeClass = f.id === "inbox"
                ? "bg-[#185FA5] text-white"
                : "bg-slate-100 text-slate-500";
              return (
                <button
                  key={f.id}
                  type="button"
                  disabled={f.soon}
                  onClick={() => { if (!f.soon) selectFolder(f.id as FolderId); }}
                  className={`flex w-full items-center gap-2.5 rounded-full px-3 py-2 text-sm ${isActive ? "bg-[#E6F1FB] font-medium text-[#0C447C]" : f.soon ? "cursor-not-allowed text-slate-300" : "text-slate-600 hover:bg-slate-100"}`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="flex-1 text-left">{f.label}</span>
                  {rawCount > 0 ? (
                    <span className={`inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 text-[11px] font-medium leading-5 ${badgeClass}`}>{badge}</span>
                  ) : null}
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
              <button type="button" onClick={() => { setActive(null); setMessages([]); setOpenCardId(null); }} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Back to inbox"><ArrowLeft className="h-4 w-4" /></button>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-950">{active.subject ?? "(no subject)"}</p>
                <p className="truncate text-xs text-slate-500">{active.contact_name ? `${active.contact_name} · ` : ""}{active.contact_email}</p>
              </div>
            </div>
            <button type="button" onClick={() => void deleteThread(active.id)} className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-400 hover:border-[#F7C1C1] hover:bg-[#FCEBEB] hover:text-[#A32D2D]" aria-label="Delete conversation"><Trash2 className="h-4 w-4" /></button>
          </div>
          <div className="max-h-[460px] space-y-5 overflow-y-auto px-5 py-4">
            {messages.map((m) => {
              const outbound = m.direction === "outbound";
              const senderName = outbound ? "You" : (m.from_name ?? m.from_email);
              const sender: Sender = { name: m.from_name ?? m.from_email, email: m.from_email };
              return (
                <div key={m.id} className="flex gap-3 border-b border-slate-100 pb-5 last:border-0 last:pb-0">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E6F1FB] text-xs font-semibold text-[#0C447C]">{initials(senderName)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      {outbound ? (
                        <p className="truncate text-sm"><span className="font-semibold text-slate-900">You</span> <span className="text-xs text-slate-400">&lt;{m.from_email}&gt;</span></p>
                      ) : (
                        <SenderHeader
                          sender={sender}
                          date={m.created_at}
                          security={TLS_SECURITY}
                          open={openCardId === m.id}
                          onToggle={() => setOpenCardId((cur) => (cur === m.id ? null : m.id))}
                          onClose={() => setOpenCardId(null)}
                          onEmail={onCardEmail}
                          onAddContact={onCardAddContact}
                        />
                      )}
                      <span className="shrink-0 text-xs text-slate-400">{new Date(m.created_at).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                    </div>
                    <p className="text-[11px] text-slate-400">to {m.to_email}</p>
                    <div className="mt-2.5"><EmailBody html={m.body_html} text={m.body_text} /></div>
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
            <div className="mb-2 flex flex-wrap gap-2">
              <button type="button" onClick={startReply} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"><Reply className="h-3.5 w-3.5" /> Reply</button>
              <button type="button" onClick={startReplyAll} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"><ReplyAll className="h-3.5 w-3.5" /> Reply all</button>
              <button type="button" onClick={startForward} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"><Forward className="h-3.5 w-3.5" /> Forward</button>
            </div>
            <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} placeholder="Quick reply…" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[var(--blue)] focus:outline-none" />
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
                <input type="file" multiple className="hidden" onChange={(e) => { void uploadReplyFiles(e.target.files); e.target.value = ""; }} />
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

          {folder !== "drafts" ? (
            selected.size > 0 ? (
              <div className="flex flex-wrap items-center gap-3 rounded-lg bg-[#E6F1FB] px-3 py-2 text-[#0C447C]">
                <span className="text-xs font-semibold">{selected.size} selected</span>
                {folder !== "trash" && folder !== "spam" ? (
                  <>
                    <button type="button" onClick={() => void runBulk("read")} className="inline-flex items-center gap-1 text-xs hover:underline"><MailOpen className="h-3.5 w-3.5" /> Mark read</button>
                    <button type="button" onClick={() => void runBulk("unread")} className="inline-flex items-center gap-1 text-xs hover:underline"><Mail className="h-3.5 w-3.5" /> Unread</button>
                    <button type="button" onClick={() => void runBulk("spam")} className="inline-flex items-center gap-1 text-xs hover:underline"><AlertTriangle className="h-3.5 w-3.5" /> Spam</button>
                  </>
                ) : null}
                <button type="button" onClick={() => void runBulk("delete")} className="inline-flex items-center gap-1 text-xs hover:underline"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-xs text-slate-500 hover:underline">Clear</button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <button type="button" onClick={() => setSelectMenuOpen((v) => !v)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
                    <input type="checkbox" readOnly checked={false} className="h-3.5 w-3.5" aria-label="Select" /> <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  {selectMenuOpen ? (
                    <div className="absolute left-0 top-full z-10 mt-1 w-32 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                      {(["all", "none", "read", "unread"] as const).map((m) => (
                        <button key={m} type="button" onClick={() => selectBy(m)} className="block w-full px-3 py-1.5 text-left text-xs capitalize text-slate-700 hover:bg-slate-100">{m}</button>
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
            )
          ) : null}

          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)]">
            {folder === "drafts" ? (
              loading ? (
                <ListRowsSkeleton />
              ) : drafts.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-slate-400">No drafts. Start one from Compose, then Save draft.</p>
              ) : (
                <ul>
                  {drafts.map((d) => (
                    <li key={d.id} className="group flex items-start gap-3 border-b border-slate-50 px-4 py-3 last:border-0 hover:bg-slate-50">
                      <button type="button" onClick={() => openDraft(d)} className="min-w-0 flex-1 text-left">
                        <p className="truncate text-sm font-medium text-slate-900">{d.subject?.trim() || "(no subject)"}</p>
                        <p className="truncate text-xs text-slate-500">{d.to_email ? `To: ${d.to_email}` : "No recipient"} · {(d.body ?? "").trim().slice(0, 80) || "Empty"}</p>
                      </button>
                      <span className="text-xs text-slate-400">{when(d.updated_at)}</span>
                      <button type="button" aria-label="Discard draft" onClick={() => void discardDraft(d.id)} className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </li>
                  ))}
                </ul>
              )
            ) : loading ? (
              <ListRowsSkeleton />
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
                    className={`group flex cursor-pointer items-center gap-3 border-b border-slate-100 px-4 py-2.5 last:border-0 ${selected.has(t.id) ? "bg-[#E6F1FB]" : t.unread ? "bg-white hover:bg-slate-50" : "bg-slate-50/40 hover:bg-slate-50"}`}
                  >
                    <input type="checkbox" checked={selected.has(t.id)} onClick={(e) => e.stopPropagation()} onChange={() => toggleSelect(t.id)} className="h-3.5 w-3.5 shrink-0" aria-label="Select conversation" />
                    <span className={`w-44 shrink-0 truncate text-sm ${t.unread ? "font-semibold text-slate-950" : "text-slate-600"}`}>
                      {t.contact_name ?? t.contact_email}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      <span className={t.unread ? "font-semibold text-slate-950" : "text-slate-700"}>{t.subject ?? "(no subject)"}</span>
                      {t.snippet ? <span className="text-slate-400"> — {t.snippet}</span> : null}
                    </span>
                    {t.has_attachments ? <Paperclip className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-label="Has attachment" /> : null}
                    <span className="hidden shrink-0 items-center gap-2 group-hover:flex">
                      {folder === "trash" ? (
                        <>
                          <button type="button" title="Restore" onClick={(e) => { e.stopPropagation(); void restoreThread(t.id); }} className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-[#185FA5]"><RotateCcw className="h-4 w-4" /></button>
                          <button type="button" title="Delete forever" onClick={(e) => { e.stopPropagation(); void purgeThread(t.id); }} className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-[#A32D2D]"><Trash2 className="h-4 w-4" /></button>
                        </>
                      ) : folder === "spam" ? (
                        <>
                          <button type="button" title="Not spam" onClick={(e) => { e.stopPropagation(); void setSpam(t.id, false); }} className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-[#185FA5]"><RotateCcw className="h-4 w-4" /></button>
                          <button type="button" title="Move to Trash" onClick={(e) => { e.stopPropagation(); void deleteThread(t.id); }} className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-[#A32D2D]"><Trash2 className="h-4 w-4" /></button>
                        </>
                      ) : (
                        <>
                          <button type="button" title="Mark unread" onClick={(e) => { e.stopPropagation(); void markUnread(t.id); }} className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"><MailOpen className="h-4 w-4" /></button>
                          <button type="button" title="Report spam" onClick={(e) => { e.stopPropagation(); void setSpam(t.id, true); }} className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-[#B06A00]"><AlertTriangle className="h-4 w-4" /></button>
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

      {/* F3 wide compose modal */}
      <ComposeModal
        open={composeOpen}
        prefill={composePrefill}
        title={composeContext.mode === "forward" ? "Forward" : composeContext.mode === "reply" || composeContext.mode === "replyAll" ? "Reply" : "New message"}
        sending={sending}
        error={composeOpen ? error : null}
        onSaveDraft={composeContext.threadId ? undefined : onSaveDraft}
        onSend={(d) => void onSendCompose(d)}
        onClose={closeCompose}
        uploadFiles={uploadComposeFiles}
        uploading={uploading}
        initialAttachments={composeInitAttachments}
      />
    </div>
  );
}
