"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { MessageRow, ThreadRow } from "@/lib/linkedin/store";
import { ErrorLine, api, btnCls, primaryCls } from "./ui";

/** LinkedIn conversations. Rows arrive once the sender (Step 2) or notification emails (Step 3) are live. */
export function LinkedInInbox({ threads: initial, onChanged }: Readonly<{ threads?: ThreadRow[]; onChanged?: () => void }>) {
  const [fetched, setFetched] = useState<ThreadRow[] | null>(null);
  const threads = initial ?? fetched;
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initial) return;
    let alive = true;
    api<{ threads: ThreadRow[] }>("/api/admin/linkedin").then((r) => { if (alive) { if (r.ok) setFetched(r.data.threads); else setError(r.error); } });
    return () => { alive = false; };
  }, [initial]);

  const open = useCallback(async (id: string) => {
    setSelected(id);
    const r = await api<{ messages: MessageRow[] }>(`/api/admin/linkedin/threads/${id}`);
    if (r.ok) setMessages(r.data.messages); else setError(r.error);
  }, []);

  async function takeOver(id: string) {
    setBusy(true); setError(null);
    const r = await api(`/api/admin/linkedin/threads/${id}`, "POST");
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    if (initial) onChanged?.();
    else setFetched((t) => (t ?? []).map((x) => (x.id === id ? { ...x, state: "human", unread: false } : x)));
  }

  if (threads === null) return <p className="p-4 text-[13px] text-slate-500">{error ?? "Loading…"}</p>;
  if (threads.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-[13px] text-slate-600">
        <p className="font-medium text-slate-800">No LinkedIn conversations yet.</p>
        <p className="mt-1">They appear here once the automatic sender is connected. Until then, campaigns queue people and make tasks for invites you send by hand.</p>
      </div>
    );
  }
  const current = threads.find((t) => t.id === selected) ?? null;
  return (
    <div className="grid overflow-hidden rounded-xl border border-slate-200 bg-white md:grid-cols-[260px_1fr]">
      <ul className="max-h-[60vh] overflow-y-auto border-b border-slate-100 md:border-b-0 md:border-r">
        {threads.map((t) => (
          <li key={t.id}>
            <button type="button" onClick={() => open(t.id)} className={`block w-full border-b border-slate-100 px-3 py-2.5 text-left ${t.id === selected ? "bg-[#EEF4FF]" : "hover:bg-slate-50"}`}>
              <span className={`text-[13px] ${t.unread ? "font-semibold" : "font-medium"} text-slate-900`}>{t.contact_name}</span>
              <span className="block truncate text-[12px] text-slate-500">{t.last_preview ?? ""}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="p-4">
        {!current ? <p className="text-[13px] text-slate-500">Choose a conversation.</p> : (
          <div className="space-y-3">
            <p className="text-[14px] font-semibold text-slate-900">{current.contact_name}</p>
            <div className="space-y-2">
              {messages.map((m) => (
                <p key={m.id} className={`max-w-[85%] rounded-lg px-3 py-2 text-[13px] ${m.direction === "in" ? "bg-slate-100 text-slate-800" : "ml-auto bg-[#EEF4FF] text-slate-800"}`}>{m.body}</p>
              ))}
            </div>
            <p className="text-[12px] text-slate-500">{current.state === "ai_active" ? "Our AI assistant is replying. You can take over any time." : current.state === "human" ? "You have taken over this conversation." : "Closed."}</p>
            <ErrorLine text={error} />
            <div className="flex gap-2">
              {current.state === "ai_active" ? <button type="button" className={primaryCls} disabled={busy} onClick={() => takeOver(current.id)}>Take over</button> : null}
              {current.contact_id ? <Link href={`/admin/sales/contacts/${current.contact_id}`} className={btnCls}>Open contact</Link> : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
