"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Mail, RefreshCw, ArrowLeft, ExternalLink, Inbox as InboxIcon, Send } from "lucide-react";

type GmailItem = { id: string; threadId: string; from: string; subject: string; date: string; snippet: string; unread: boolean };
type GmailMessage = { id: string; from: string; to: string; date: string; subject: string; text: string | null; html: string | null; snippet: string };
type GmailThread = { id: string; subject: string; messages: GmailMessage[] };

function stripHtml(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
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
  const [label, setLabel] = useState<"INBOX" | "SENT">("INBOX");
  const [items, setItems] = useState<GmailItem[]>([]);
  const [connected, setConnected] = useState(true);
  const [needsReadScope, setNeedsReadScope] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [thread, setThread] = useState<GmailThread | null>(null);

  const connectUrl = `/api/integrations/google/connect?returnTo=${encodeURIComponent(pathname ?? "/admin/inbox")}`;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/integrations/google/gmail/threads?label=${label}`);
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
  }, [label]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

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

  if (thread) {
    return (
      <div className="space-y-3">
        <button type="button" onClick={() => setThread(null)} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"><ArrowLeft className="h-4 w-4" /> Back</button>
        <div className="rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)]">
          <h2 className="border-b border-slate-100 px-4 py-3 text-base font-semibold text-slate-900">{thread.subject}</h2>
          <ul className="divide-y divide-slate-100">
            {thread.messages.map((m) => (
              <li key={m.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-800">{fromName(m.from)}</span>
                  <span className="text-xs text-slate-400">{when(m.date)}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">{m.text || (m.html ? stripHtml(m.html) : m.snippet)}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex gap-1 rounded-full bg-slate-100 p-1">
          {(["INBOX", "SENT"] as const).map((l) => (
            <button key={l} type="button" onClick={() => setLabel(l)} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${label === l ? "bg-white text-[#0C447C] shadow-sm" : "text-slate-500"}`}>
              {l === "INBOX" ? <InboxIcon className="h-4 w-4" /> : <Send className="h-4 w-4" />} {l === "INBOX" ? "Inbox" : "Sent"}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => void load()} className="ml-auto rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" aria-label="Refresh"><RefreshCw className="h-4 w-4" /></button>
      </div>

      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)]">
        {loading ? (
          <p className="px-4 py-8 text-sm text-slate-400">Loading your Gmail…</p>
        ) : items.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-400">Nothing here.</p>
        ) : (
          <ul>
            {items.map((t) => (
              <li key={t.threadId} role="button" tabIndex={0} onClick={() => void openThread(t.threadId)} onKeyDown={(e) => { if (e.key === "Enter") void openThread(t.threadId); }}
                className={`flex cursor-pointer items-center gap-3 border-b border-slate-100 px-4 py-2.5 last:border-0 ${t.unread ? "bg-white hover:bg-slate-50" : "bg-slate-50/40 hover:bg-slate-50"}`}>
                <span className={`w-44 shrink-0 truncate text-sm ${t.unread ? "font-semibold text-slate-950" : "text-slate-600"}`}>{fromName(t.from)}</span>
                <span className="min-w-0 flex-1 truncate text-sm">
                  <span className={t.unread ? "font-semibold text-slate-950" : "text-slate-700"}>{t.subject}</span>
                  {t.snippet ? <span className="text-slate-400"> — {t.snippet}</span> : null}
                </span>
                <span className={`w-16 shrink-0 text-right text-xs ${t.unread ? "font-semibold text-slate-900" : "text-slate-400"}`}>{when(t.date)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
