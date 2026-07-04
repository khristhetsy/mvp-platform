"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { VerifyStats } from "@/lib/verify/store";

export function VerifyClient({ stats, providerReady }: { stats: VerifyStats; providerReady: boolean }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true); setError(null); setResult(null);
    try {
      const res = await fetch("/api/contacts/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 40 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Verification failed.");
      setResult(`${data.processed} processed · ${data.valid} valid, ${data.risky} risky, ${data.invalid} invalid · ${data.appended} appended · ${data.remaining.toLocaleString()} remaining.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setRunning(false);
    }
  }

  const cards = [
    { label: "Valid", value: stats.valid, color: "#0F6E56" },
    { label: "Risky", value: stats.risky, color: "#92400E" },
    { label: "Invalid", value: stats.invalid, color: "#B91C1C" },
    { label: "Unverified", value: stats.unverified, color: "#475569" },
  ];

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[var(--shadow-panel)]">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label}>
              <div className="text-2xl font-semibold" style={{ color: c.color }}>{c.value.toLocaleString()}</div>
              <div className="text-xs text-slate-500">{c.label}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={run} disabled={running || stats.unverified === 0}
            className="rounded-lg bg-[#2E78F5] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {running ? "Verifying…" : "Run verify + append (next 40)"}
          </button>
          {result ? <span className="text-sm text-slate-600">{result}</span> : null}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Discovery provider:{" "}
          {providerReady
            ? <span className="font-medium text-emerald-700">connected — paid fill enabled for genuine gaps.</span>
            : <span className="text-slate-600">not connected — running the free cascade only. Add a HUNTER_API_KEY / APOLLO_API_KEY in Vercel to enable paid fill.</span>}
        </p>
        {error ? <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
      </section>

      <p className="text-[11px] leading-relaxed text-slate-500">
        Note: true mailbox verification needs port 25, which serverless blocks — the free tier confirms domain deliverability (MX) and flags role/invalid addresses. Pattern-inferred addresses stay risky and are never cold-sent until a provider confirms them.
      </p>
    </div>
  );
}
