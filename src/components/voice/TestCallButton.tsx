"use client";

import { useState } from "react";
import { Phone, Loader2, Check } from "lucide-react";

const BLUE = "#2E78F5";

export function TestCallButton() {
  const [state, setState] = useState<"idle" | "calling" | "done" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  async function call() {
    setState("calling");
    setMsg(null);
    try {
      const res = await fetch("/api/admin/voice/dial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "test" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Call failed.");
      setState("done");
      setMsg(`Calling ${json.dialed}… your phone should ring in a few seconds.`);
    } catch (err) {
      setState("error");
      setMsg(err instanceof Error ? err.message : "Call failed.");
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">Place a test call</p>
          <p className="text-xs text-slate-500">Dials your verified test number (VAPI_TEST_NUMBER) through Vapi. No consent needed — this is your own line.</p>
        </div>
        <button
          onClick={call}
          disabled={state === "calling"}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: BLUE }}
        >
          {state === "calling" ? <Loader2 className="h-4 w-4 animate-spin" /> : state === "done" ? <Check className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
          {state === "calling" ? "Calling…" : "Call my phone"}
        </button>
      </div>
      {msg && <p className={`mt-2 text-xs ${state === "error" ? "text-rose-600" : "text-emerald-600"}`}>{msg}</p>}
    </div>
  );
}
