"use client";

import type { VerifyStats } from "@/lib/verify/store";

export function VerifyClient({ stats, searchReady }: { stats: VerifyStats; searchReady: boolean }) {
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
        <div className="mt-4 rounded-lg bg-slate-50 px-3.5 py-3 text-xs text-slate-600">
          Verification runs on the <span className="font-medium text-slate-800">Verify &amp; correct</span> step — pick contacts there and use <span className="font-medium text-slate-800">Verify selected</span> or <span className="font-medium text-slate-800">Verify all contacts</span>. The tallies above update as you go.
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Internet search:{" "}
          {searchReady
            ? <span className="font-medium text-emerald-700">connected — the cascade can search the web for a company&apos;s site to fill genuine gaps.</span>
            : <span className="text-slate-600">not connected — running the company-website + pattern cascade only. Add a SERPER_API_KEY in Vercel to enable internet search.</span>}
        </p>
      </section>

      <p className="text-[11px] leading-relaxed text-slate-500">
        Note: true mailbox verification needs port 25, which serverless blocks — the free tier confirms domain deliverability (MX) and flags role/invalid addresses. Pattern-inferred addresses stay risky and are never cold-sent until a provider confirms them.
      </p>
    </div>
  );
}
