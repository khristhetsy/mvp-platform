"use client";

import { useEffect, useRef, useState } from "react";
import { Phone, Loader2, PhoneOutgoing, Square } from "lucide-react";

const BLUE = "#2E78F5";
const WAVE = 5;

type Dialed = { contactId: string; name: string | null; ok: boolean; error?: string };

export function BatchDialer() {
  const [dialable, setDialable] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [launched, setLaunched] = useState(0);
  const [feed, setFeed] = useState<Dialed[]>([]);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef(false);

  async function refreshCount() {
    const res = await fetch("/api/admin/voice/dial/batch");
    const json = await res.json().catch(() => ({}));
    if (res.ok) setDialable(json.dialable ?? 0);
  }

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- initial dialable count */
    void refreshCount();
  }, []);

  async function start() {
    setRunning(true); setError(null); setLaunched(0); setFeed([]);
    stopRef.current = false;
    const excluded: string[] = [];
    try {
      for (;;) {
        if (stopRef.current) break;
        const res = await fetch("/api/admin/voice/dial/batch", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ waveSize: WAVE, exclude: excluded }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Dial failed.");
        const dialed = (json.dialed ?? []) as Dialed[];
        if (dialed.length === 0) break;
        for (const d of dialed) excluded.push(d.contactId);
        setFeed((prev) => [...dialed, ...prev].slice(0, 40));
        setLaunched((n) => n + dialed.filter((d) => d.ok).length);
        // brief pause between waves
        await new Promise((r) => setTimeout(r, 1500));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dial failed.");
    } finally {
      setRunning(false);
      void refreshCount();
    }
  }

  function stop() { stopRef.current = true; }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">Outbound dialer</p>
          <p className="text-xs text-slate-500">
            {dialable === null ? "Checking eligibility…" : <><strong className="text-slate-800">{dialable.toLocaleString()}</strong> contact{dialable === 1 ? "" : "s"} eligible to dial now · dials in waves of {WAVE}</>}
          </p>
        </div>
        {running ? (
          <button onClick={stop} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50">
            <Square className="h-4 w-4" /> Stop
          </button>
        ) : (
          <button onClick={start} disabled={dialable === 0} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: BLUE }}>
            <PhoneOutgoing className="h-4 w-4" /> Call all dialable now
          </button>
        )}
      </div>

      {error && <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}

      {(running || launched > 0 || feed.length > 0) && (
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
            {running && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>Launched {launched.toLocaleString()} call{launched === 1 ? "" : "s"}{running ? "…" : ""}</span>
          </div>
          <div className="overflow-hidden rounded-lg border border-slate-100">
            {feed.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-slate-400">Placing calls…</p>
            ) : feed.map((d, i) => (
              <div key={i} className="flex items-center justify-between border-b border-slate-50 px-3 py-2 text-sm last:border-0">
                <span className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-slate-400" /> {d.name ?? d.contactId}</span>
                {d.ok ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Dialing</span>
                      : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">Skipped · {d.error}</span>}
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-slate-400">Outcomes (answered, booked, opt-out) land in Voice Call Review as each call ends.</p>
        </div>
      )}
    </div>
  );
}
