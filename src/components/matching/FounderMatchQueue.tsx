"use client";

import { useState, useTransition } from "react";
import type { FounderMatchItem } from "@/lib/matching/queue";
import { founderApproveMatch, founderDeclineMatch } from "@/app/founder/matches/actions";

type LocalStatus = FounderMatchItem["status"] | "removed";

export function FounderMatchQueue({ items }: Readonly<{ items: FounderMatchItem[] }>) {
  const [statuses, setStatuses] = useState<Record<string, LocalStatus>>(
    () => Object.fromEntries(items.map((i) => [i.matchId, i.status])),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function act(matchId: string, kind: "approve" | "decline") {
    setError(null);
    startTransition(async () => {
      const res = kind === "approve" ? await founderApproveMatch(matchId) : await founderDeclineMatch(matchId);
      if (res.ok) {
        setStatuses((s) => ({ ...s, [matchId]: kind === "approve" ? "introduced" : "removed" }));
      } else {
        setError(res.error);
      }
    });
  }

  const visible = items.filter((i) => statuses[i.matchId] !== "removed");

  if (visible.length === 0) {
    return (
      <div className="rounded-2xl border border-[#E3E8F2] bg-white px-8 py-14 text-center">
        <p className="text-sm font-semibold text-[#0A1A40]">No interested investors yet</p>
        <p className="mt-1 text-xs text-[#5A6782]">When a matched investor expresses interest, they appear here for your approval.</p>
      </div>
    );
  }

  return (
    <div>
      {error ? <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {visible.map((it) => {
          const status = statuses[it.matchId];
          return (
            <article key={it.matchId} className="flex flex-col gap-3 rounded-2xl border border-[#E3E8F2] bg-white p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-[#0A1A40]">{it.investorType ?? "Investor"}</span>
                <span className="rounded-full bg-[#EAF1FD] px-2.5 py-1 text-[11px] font-bold text-[#1A6CE4]">Match {Math.round(it.matchScore)}</span>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-[12px]">
                <Field label="Check size" value={it.checkSize ?? "—"} />
                <Field label="Focus sectors" value={it.sectors.join(", ") || "—"} />
                <Field label="Stages" value={it.stages.join(", ") || "—"} />
                <Field label="Geography" value={it.geographies.join(", ") || "—"} />
              </dl>

              {status === "investor_interested" ? (
                <div className="mt-1 flex gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => act(it.matchId, "approve")}
                    className="flex-1 rounded-lg bg-[#0E9F6E] px-3 py-2 text-[13px] font-bold text-white hover:bg-[#0c8b60] disabled:opacity-50"
                  >
                    Approve introduction
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => act(it.matchId, "decline")}
                    className="rounded-lg border border-[#E3E8F2] px-3 py-2 text-[13px] font-medium text-[#5A6782] hover:bg-[#F6F8FC] disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              ) : (
                <p className="mt-1 rounded-lg bg-[#E6F7F0] px-3 py-2 text-[12px] font-semibold text-[#0B5C41]">
                  ✓ Introduced — you can now connect with this investor.
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
