"use client";

import { useState, useTransition } from "react";
import type { AnonymizedMatchCard } from "@/lib/matching/anonymized-cards";
import { investorExpressInterest, investorDeclineMatch } from "@/app/investor/matches/actions";

type LocalStatus = AnonymizedMatchCard["status"] | "removed";

function reasonsOf(breakdown: unknown): string[] {
  if (breakdown && typeof breakdown === "object" && "reasons" in breakdown) {
    const r = (breakdown as { reasons?: unknown }).reasons;
    if (Array.isArray(r)) return r.map(String).slice(0, 4);
  }
  return [];
}

export function InvestorMatchList({ cards }: Readonly<{ cards: AnonymizedMatchCard[] }>) {
  const [statuses, setStatuses] = useState<Record<string, LocalStatus>>(
    () => Object.fromEntries(cards.map((c) => [c.matchId, c.status])),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function act(matchId: string, kind: "interested" | "decline") {
    setError(null);
    startTransition(async () => {
      const res = kind === "interested" ? await investorExpressInterest(matchId) : await investorDeclineMatch(matchId);
      if (res.ok) {
        setStatuses((s) => ({ ...s, [matchId]: kind === "interested" ? "investor_interested" : "removed" }));
      } else {
        setError(res.error);
      }
    });
  }

  const visible = cards.filter((c) => statuses[c.matchId] !== "removed");

  if (visible.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-8 py-14 text-center">
        <p className="text-sm font-semibold text-slate-700">No matches yet</p>
        <p className="mt-1 text-xs text-slate-500">Fit-scored founder matches appear here as they&apos;re generated.</p>
      </div>
    );
  }

  return (
    <div>
      {error ? <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {visible.map((c) => {
          const status = statuses[c.matchId];
          const reasons = reasonsOf(c.scoreBreakdown);
          return (
            <article key={c.matchId} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-[#EAF1FD] px-2.5 py-1 text-[11px] font-semibold text-[#1A6CE4]">
                  Match {Math.round(c.matchScore)}
                </span>
                <span className="text-[11px] font-medium text-slate-400">Anonymized until introduced</span>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-[12px]">
                <Field label="Industry" value={c.industry ?? "—"} />
                <Field label="Stage" value={c.stage ?? "—"} />
                <Field label="Raise" value={c.raiseBand ?? "—"} />
                <Field label="Readiness" value={c.readinessBand} />
              </dl>
              {reasons.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {reasons.map((r) => (
                    <span key={r} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] text-slate-600">{r}</span>
                  ))}
                </div>
              ) : null}

              {status === "investor_notified" ? (
                <div className="mt-1 flex gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => act(c.matchId, "interested")}
                    className="flex-1 rounded-lg bg-[#1A6CE4] px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
                  >
                    Interested
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => act(c.matchId, "decline")}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-[13px] font-medium text-slate-600 disabled:opacity-50"
                  >
                    Pass
                  </button>
                </div>
              ) : status === "investor_interested" ? (
                <p className="mt-1 rounded-lg bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-700">
                  ✓ Interest sent — awaiting the founder&apos;s approval to introduce.
                </p>
              ) : (
                <p className="mt-1 rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-500">
                  Approved — introduction in progress.
                </p>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-lg bg-slate-50 px-2.5 py-2">
      <dt className="text-[10.5px] uppercase tracking-[0.5px] text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-[12.5px] font-semibold text-slate-800">{value}</dd>
    </div>
  );
}
