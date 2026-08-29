"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type FounderRequestRow = {
  id: string;
  subject: string;
  status: string;
  contextItem: string | null;
  csat: number | null;
  createdAt: string;
};

type Message = { id: string; author_role: "founder" | "staff"; body: string; created_at: string };

const STATUS_STYLE: Record<string, string> = {
  open: "bg-amber-50 text-amber-700",
  pending_founder: "bg-blue-50 text-blue-700",
  resolved: "bg-emerald-50 text-emerald-700",
};
const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  pending_founder: "Awaiting you",
  resolved: "Resolved",
};

export function FounderSupportClient({ rows }: Readonly<{ rows: FounderRequestRow[] }>) {
  const router = useRouter();
  const [selected, setSelected] = useState<FounderRequestRow | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  async function open(row: FounderRequestRow) {
    setSelected(row);
    setMessages([]);
    setReply("");
    const res = await fetch(`/api/founder/support/${row.id}`);
    if (res.ok) {
      const json = await res.json();
      setMessages(json.messages ?? []);
    }
  }

  async function sendReply() {
    if (!selected || !reply.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/founder/support/${selected.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply.trim() }),
      });
      if (res.ok) {
        setReply("");
        await open(selected);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function rate(csat: 1 | -1) {
    if (!selected) return;
    setBusy(true);
    try {
      await fetch(`/api/founder/support/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csat }),
      });
      setSelected({ ...selected, csat });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        No support requests yet. Use the &ldquo;Request help&rdquo; button on any screen when you&apos;re stuck.
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <ul className="divide-y divide-slate-100">
          {rows.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => open(r)} className={`w-full px-4 py-3 text-left hover:bg-slate-50 ${selected?.id === r.id ? "bg-indigo-50/60" : ""}`}>
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{r.subject}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[r.status] ?? "bg-slate-100 text-slate-600"}`}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </div>
                {r.contextItem ? <p className="mt-0.5 truncate text-xs text-slate-500">{r.contextItem}</p> : null}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        {!selected ? (
          <div className="p-6 text-sm text-slate-500">Select a request to view the conversation.</div>
        ) : (
          <div className="flex flex-col">
            <div className="border-b border-slate-100 p-4">
              <p className="text-sm font-semibold text-slate-900">{selected.subject}</p>
            </div>
            <div className="space-y-2 p-4">
              {messages.length === 0 ? (
                <p className="text-xs text-slate-400">No messages yet.</p>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={`max-w-[85%] rounded-xl px-3 py-2 ${m.author_role === "founder" ? "ml-auto bg-indigo-600 text-white" : "bg-slate-100 text-slate-800"}`}>
                    <p className="text-[13px] leading-snug">{m.body}</p>
                    <p className={`mt-1 text-[10px] ${m.author_role === "founder" ? "text-indigo-200" : "text-slate-400"}`}>
                      {m.author_role === "founder" ? "You" : "iCapOS team"} · {new Date(m.created_at).toLocaleString("en-US")}
                    </p>
                  </div>
                ))
              )}
            </div>

            {selected.status === "resolved" ? (
              <div className="border-t border-slate-100 p-4">
                {selected.csat ? (
                  <p className="text-xs text-slate-500">Thanks for your feedback{selected.csat === 1 ? " 👍" : ""}.</p>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-600">Was this helpful?</span>
                    <button type="button" disabled={busy} onClick={() => rate(1)} className="rounded-lg border border-slate-200 px-3 py-1 text-sm hover:bg-slate-50">👍 Yes</button>
                    <button type="button" disabled={busy} onClick={() => rate(-1)} className="rounded-lg border border-slate-200 px-3 py-1 text-sm hover:bg-slate-50">👎 No</button>
                  </div>
                )}
              </div>
            ) : (
              <div className="border-t border-slate-100 p-3">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={2}
                  placeholder="Reply to the team…"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                />
                <div className="mt-2 flex justify-end">
                  <button type="button" disabled={busy || !reply.trim()} onClick={sendReply} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                    {busy ? "Sending…" : "Send"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
