"use client";

import { useState } from "react";
import { Users, Send, HandCoins, Gauge, type LucideIcon } from "lucide-react";
import type { FounderPrivateMarketSummary } from "@/lib/founder/private-market";

type CardKey = "contacts" | "reached" | "pledged" | "score";

function money(n: number): string {
  return n > 0
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: n >= 1_000_000 ? "compact" : "standard", maximumFractionDigits: n >= 1_000_000 ? 1 : 0 }).format(n)
    : "$0";
}

export function FounderPrivateMarketSummaryCards({
  summary,
  rankedCount,
}: Readonly<{ summary: FounderPrivateMarketSummary; rankedCount: number }>) {
  const [open, setOpen] = useState<CardKey | null>(null);

  const cards: { key: CardKey; icon: LucideIcon; label: string; value: string; sub: string; tint: string; bg: string }[] = [
    { key: "contacts", icon: Users, label: "Total investor contacts", value: summary.totalContacts.toLocaleString(), sub: "in the iCapOS network", tint: "var(--indigo)", bg: "var(--indigo-soft)" },
    { key: "reached", icon: Send, label: "Reached out", value: String(summary.reachedOut), sub: `of ${summary.investorUniverse} contacted`, tint: "var(--teal)", bg: "var(--teal-muted)" },
    { key: "pledged", icon: HandCoins, label: "Pledged", value: money(summary.pledgedTotal), sub: "soft commitments", tint: "var(--navy)", bg: "var(--navy-muted)" },
    { key: "score", icon: Gauge, label: "Avg investor score", value: summary.avgScore != null ? String(summary.avgScore) : "—", sub: "across rated investors", tint: "var(--navy)", bg: "var(--navy-muted)" },
  ];

  const detail: Record<CardKey, { title: string; sub: string; rows: [string, string][]; advice: string[] }> = {
    contacts: {
      title: "Total investor contacts",
      sub: "The iCapOS investor network",
      rows: [
        ["In network", summary.totalContacts.toLocaleString()],
        ["Ranked to you", `${rankedCount} (best fit)`],
        ["Approved members", String(summary.investorUniverse)],
      ],
      advice: [
        "The network is large, but only a handful currently score above “Moderate” for you — sharpen your profile to climb their lists.",
        "Completing your data room and raising your readiness score is the fastest way to move up the ranking.",
      ],
    },
    reached: {
      title: "Reached out",
      sub: "Introductions run by the iCapOS team",
      rows: [
        ["Contacted", String(summary.reachedOut)],
        ["Approved members", String(summary.investorUniverse)],
      ],
      advice: [
        summary.reachedOut === 0
          ? "No outreach yet. Introductions are admin-run — make sure your listing is published so the team can queue high-fit investors."
          : `${summary.reachedOut} investor${summary.reachedOut === 1 ? "" : "s"} contacted. Respond quickly to any replies — speed is a strong predictor of a close.`,
      ],
    },
    pledged: {
      title: "Pledged",
      sub: "Soft, non-binding commitments",
      rows: [["Total pledged", money(summary.pledgedTotal)]],
      advice: [
        summary.pledgedTotal === 0
          ? "Pledges follow document access. Upload your financial model and cap table — investors rarely pledge before reviewing them."
          : "Turn soft pledges into commitments by scheduling calls with each pledging investor this week.",
      ],
    },
    score: {
      title: "Avg investor score",
      sub: "Platform partner-quality rating",
      rows: [["Average", summary.avgScore != null ? String(summary.avgScore) : "— (insufficient data)"]],
      advice: [
        summary.avgScore == null
          ? "Investor scores need engagement history (pledges, deal rooms, responsiveness). Your ranked investors have little yet, so scores read “insufficient data” — they populate as they engage."
          : "A higher average means more active, responsive partners in your ranking — prioritize the highest-scored for outreach.",
      ],
    },
  };

  const cfg = open ? detail[open] : null;

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setOpen(c.key)}
              className="group rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-[#2E78F5] hover:shadow-[0_0_0_3px_var(--indigo-soft)]"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: c.bg, color: c.tint }}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{c.label}</span>
              </div>
              <div className="mt-2 font-mono text-[22px] font-semibold text-slate-900">{c.value}</div>
              <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                <span>{c.sub}</span>
                <span className="font-medium text-[#2E78F5] opacity-0 transition group-hover:opacity-100">Tap →</span>
              </div>
            </button>
          );
        })}
      </div>

      {cfg ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4" role="dialog" aria-modal="true" onClick={() => setOpen(null)}>
          <div className="w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl" style={{ maxHeight: "88vh" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-[var(--navy)]">{cfg.title}</h3>
                <p className="text-xs text-slate-500">{cfg.sub}</p>
              </div>
              <button type="button" onClick={() => setOpen(null)} aria-label="Close" className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <dl className="mt-4 text-[13px]">
              {cfg.rows.map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-slate-100 py-2 last:border-0">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="font-medium text-slate-800">{v}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-4 rounded-xl p-4" style={{ background: "#0c2340" }}>
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: "#2E78F5" }}>AI</span>
                <span className="text-[13px] font-medium" style={{ color: "#EEEDFE" }}>What this means</span>
              </div>
              {cfg.advice.map((a, i) => (
                <div key={i} className="my-1.5 flex gap-2 text-[12px] leading-relaxed" style={{ color: "#AFA9EC" }}>
                  <b style={{ color: "#7F77DD" }}>{i + 1}.</b>
                  <span>{a}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
