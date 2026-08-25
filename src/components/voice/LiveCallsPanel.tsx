"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type LiveCall = {
  callId: string;
  contactName: string | null;
  company: string | null;
  variantLabel: string | null;
  status: "ringing" | "talking" | "transferring" | "ending";
  aiDisclosed: boolean;
  startedAt: string;
};

const STATUS: Record<LiveCall["status"], { label: string; cls: string }> = {
  ringing: { label: "Ringing", cls: "bg-amber-50 text-amber-700" },
  talking: { label: "Talking", cls: "bg-emerald-50 text-emerald-700" },
  transferring: { label: "Transferring", cls: "bg-blue-50 text-blue-700" },
  ending: { label: "Ending", cls: "bg-slate-100 text-slate-500" },
};

function elapsed(startedAt: string, now: number): string {
  const s = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function LiveCallsPanel({ canControl }: { canControl: boolean }) {
  const [calls, setCalls] = useState<LiveCall[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const loaded = useRef(false);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/voice/live");
      if (!res.ok) return;
      const j = await res.json();
      setCalls(Array.isArray(j.calls) ? j.calls : []);
    } catch { /* transient — keep last */ }
  }, []);

  useEffect(() => {
    if (!loaded.current) { loaded.current = true; void poll(); }
    const p = setInterval(() => void poll(), 4000);
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(p); clearInterval(t); };
  }, [poll]);

  async function transfer(callId: string) {
    setBusy(callId); setMsg(null);
    try {
      const res = await fetch(`/api/admin/voice/live/${encodeURIComponent(callId)}/transfer`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Transfer failed.");
      setMsg("Transferring to a rep…");
      void poll();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Transfer failed.");
    } finally { setBusy(null); }
  }

  return (
    <section className="rounded-2xl border border-slate-200 p-4">
      <div className="mb-3 flex items-center">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-slate-400">Live now · {calls.length}</span>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-slate-400"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> auto-refresh</span>
      </div>
      {msg && <p className="mb-2 text-[11px] text-slate-600">{msg}</p>}
      {calls.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">No calls in progress.</p>
      ) : (
        calls.map((c) => {
          const st = STATUS[c.status];
          return (
            <div key={c.callId} className="flex items-center gap-2 border-b border-slate-50 py-2.5 last:border-0">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-semibold text-slate-800">{c.contactName ?? "Contact"}</div>
                <div className="truncate text-[10.5px] text-slate-500">{[c.company, c.variantLabel].filter(Boolean).join(" · ") || "—"}{!c.aiDisclosed && c.status !== "ringing" && <span className="ml-1 text-rose-600">· disclosure pending</span>}</div>
              </div>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9.5px] font-bold ${st.cls}`}><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />{st.label}</span>
              <span className="w-11 text-right text-[11.5px] font-semibold tabular-nums text-slate-500">{elapsed(c.startedAt, now)}</span>
              {canControl && c.status === "talking" && (
                <button type="button" onClick={() => transfer(c.callId)} disabled={busy === c.callId} className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                  {busy === c.callId ? "…" : "Transfer"}
                </button>
              )}
            </div>
          );
        })
      )}
    </section>
  );
}
