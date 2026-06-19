import type { FounderFacingPartner } from "@/lib/investor-rating/founder-view";

const TIER_CLASS: Record<string, string> = {
  premier: "bg-emerald-50 text-emerald-700",
  established: "bg-indigo-50 text-indigo-700",
  active: "bg-amber-50 text-amber-800",
  emerging: "bg-slate-100 text-slate-600",
  new: "bg-slate-100 text-slate-500",
};

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">{children}</span>
  );
}

/**
 * Founder-facing investor standing: tier badge + a few objective facts.
 * Consumes only the FounderFacingPartner projection — never a raw score.
 */
export function FounderFacingInvestorTier({
  view,
  showFacts = true,
}: Readonly<{
  view: FounderFacingPartner;
  showFacts?: boolean;
}>) {
  return (
    <div className="flex flex-col gap-1.5">
      <span
        className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
          TIER_CLASS[view.tier] ?? TIER_CLASS.new
        }`}
      >
        {view.tierLabel}
      </span>
      {showFacts ? (
        <div className="flex flex-wrap gap-1.5">
          {view.facts.repliesWithin ? <Chip>Replies {view.facts.repliesWithin}</Chip> : null}
          {view.facts.dealsClosed > 0 ? (
            <Chip>
              {view.facts.dealsClosed} deal{view.facts.dealsClosed === 1 ? "" : "s"} closed
            </Chip>
          ) : null}
          {view.facts.reliableFollowThrough ? <Chip>Reliable follow-through</Chip> : null}
          {view.facts.activeRecently ? <Chip>Active recently</Chip> : null}
        </div>
      ) : null}
    </div>
  );
}
