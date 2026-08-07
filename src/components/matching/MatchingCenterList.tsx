"use client";

// Shared anonymized match-card list for the founder + investor Matching Centers.
// Identity is withheld; only fit score, coarse descriptors, and reason chips show.
// Founder cards may carry an opaque `introRef` + `introEndpoint` to request a
// brokered introduction without revealing the investor's identity.
import { useState } from "react";
import { InvestorDetailModal, type InvestorDetail } from "@/components/founder/InvestorDetailModal";

export type MatchCenterCard = {
  matchScore: number;
  tag: string;
  title: string;
  subtitle: string | null;
  reasons: string[];
  introRef?: string;
  /** When present, clicking the card opens the anonymized detail panel. */
  detail?: InvestorDetail;
};

function barColor(score: number): string {
  if (score >= 70) return "#17a06a";
  if (score >= 45) return "#5b8def";
  return "#cbd5e1";
}

function IntroButton({ introRef, endpoint }: { introRef: string; endpoint: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function request() {
    setState("loading");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: introRef }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return <span className="text-xs font-medium text-emerald-600">Requested — the iCapOS team will follow up.</span>;
  }
  return (
    <button
      type="button"
      onClick={request}
      disabled={state === "loading"}
      className="rounded-lg bg-[var(--brand-indigo,#2E78F5)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
    >
      {state === "loading" ? "Requesting…" : state === "error" ? "Retry request" : "Request introduction"}
    </button>
  );
}

export function MatchingCenterList({
  cards,
  emptyText,
  introEndpoint,
}: {
  cards: MatchCenterCard[];
  emptyText: string;
  introEndpoint?: string;
}) {
  const [selected, setSelected] = useState<InvestorDetail | null>(null);

  if (cards.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
        <p className="text-sm text-slate-500">{emptyText}</p>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-4">
      {cards.map((c, i) => (
        <div
          key={i}
          onClick={c.detail ? () => setSelected(c.detail!) : undefined}
          role={c.detail ? "button" : undefined}
          tabIndex={c.detail ? 0 : undefined}
          onKeyDown={c.detail ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(c.detail!); } } : undefined}
          className={`rounded-2xl border border-slate-200 bg-white p-5 ${c.detail ? "cursor-pointer transition-colors hover:border-[var(--brand-indigo,#2E78F5)]" : ""}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                {c.matchScore}% match
              </span>
              <p className="mt-2 truncate text-sm font-semibold text-slate-900">{c.title}</p>
              {c.subtitle && <p className="text-xs text-slate-500">{c.subtitle}</p>}
            </div>
            <span className="flex-none rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
              {c.tag}
            </span>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full" style={{ width: `${Math.max(c.matchScore, 3)}%`, background: barColor(c.matchScore) }} />
          </div>

          {c.reasons.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {c.reasons.map((r) => (
                <span key={r} className="rounded-full border border-slate-200 px-2.5 py-0.5 text-[11px] text-slate-600">
                  {r}
                </span>
              ))}
            </div>
          )}

          {introEndpoint && c.introRef && (
            <div className="mt-4 flex justify-end" onClick={(e) => e.stopPropagation()}>
              <IntroButton introRef={c.introRef} endpoint={introEndpoint} />
            </div>
          )}
        </div>
      ))}
    </div>
    {selected && <InvestorDetailModal detail={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
