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
      <div className="rounded-2xl border border-[#E3E8F2] bg-white px-8 py-14 text-center">
        <p className="text-sm font-semibold text-[#0A1A40]">No matches yet</p>
        <p className="mt-1 text-xs text-[#5A6782]">Fit-scored founder matches appear here as they&apos;re generated.</p>
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
            <article key={c.matchId} className="flex flex-col gap-3 rounded-2xl border border-[#E3E8F2] bg-white p-5">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-[#EAF1FD] px-2.5 py-1 text-[11px] font-bold text-[#1A6CE4]">
                  Match {Math.round(c.matchScore)}
                </span>
                <span className="text-[11px] font-medium text-[#9aa2b1]">Anonymized until introduced</span>
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
                    <span key={r} className="rounded-full bg-[#EFF2F7] px-2.5 py-0.5 text-[10.5px] text-[#5A6782]">{r}</span>
                  ))}
                </div>
              ) : null}

              {status === "investor_notified" ? (
                <div className="mt-1 flex gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => act(c.matchId, "interested")}
                    className="flex-1 rounded-lg bg-[#1A6CE4] px-3 py-2 text-[13px] font-bold text-white hover:bg-[#155cc4] disabled:opacity-50"
                  >
                    Interested
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => act(c.matchId, "decline")}
                    className="rounded-lg border border-[#E3E8F2] px-3 py-2 text-[13px] font-medium text-[#5A6782] hover:bg-[#F6F8FC] disabled:opacity-50"
                  >
                    Pass
                  </button>
                </div>
              ) : status === "investor_interested" ? (
                <p className="mt-1 rounded-lg bg-[#E6F7F0] px-3 py-2 text-[12px] font-semibold text-[#0B5C41]">
                  ✓ Interest sent — awaiting the founder&apos;s approval to introduce.
                </p>
              ) : (
                <p className="mt-1 rounded-lg bg-[#EEF1F7] px-3 py-2 text-[12px] text-[#2E3A54]">
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
    <div className="rounded-lg bg-[#F6F8FC] px-2.5 py-2">
      <dt className="text-[10.5px] uppercase tracking-[0.5px] text-[#5A6782]">{label}</dt>
      <dd className="mt-0.5 text-[12.5px] font-bold text-[#16223F]">{value}</dd>
    </div>
  );
}
