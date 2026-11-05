"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CapitalReadyBadge } from "@/components/CapitalReadyBadge";
import { OnePagerShell } from "@/components/marketing/OnePagerShell";
import type { LiveBoardRow } from "@/lib/marketplace/live-board";

/** Company one pager for a live, admin-approved listing. Public fields only. */
export function LiveDealOnePagerDrawer({
  deal,
  onClose,
}: Readonly<{ deal: LiveBoardRow | null; onClose: () => void }>) {
  if (!deal) return null;

  const facts: { label: string; value: string | null }[] = [
    { label: "Funding target", value: deal.target },
    { label: "Minimum", value: deal.minimum },
    { label: "Stage", value: deal.stage },
    { label: "Location", value: deal.location },
  ];

  return (
    <OnePagerShell
      ariaLabel={`${deal.name} one pager`}
      eyebrow={`Company one pager${deal.industry ? ` · ${deal.industry}` : ""}`}
      title={
        <>
          {deal.name}
          {deal.capitalReady ? <CapitalReadyBadge /> : null}
        </>
      }
      subtitle={deal.symbol}
      onClose={onClose}
    >
      {deal.summary ? <p className="text-sm leading-6 text-slate-600">{deal.summary}</p> : null}

      <dl className="grid grid-cols-2 gap-2.5">
        {facts.map((f) => (
          <div key={f.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">{f.label}</dt>
            <dd className="mt-1 text-sm font-semibold text-[var(--navy)]">{f.value ?? "Not provided"}</dd>
          </div>
        ))}
      </dl>

      <Link
        href={`/deals/${deal.slug}`}
        className="cap-btn-primary inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-5 py-3 text-sm font-semibold"
      >
        View full listing
        <ArrowUpRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
      </Link>

      <p className="font-mono text-[10px] leading-relaxed text-slate-500">
        Admin-reviewed listing. Shown for informational purposes only and not an investment recommendation.
      </p>
    </OnePagerShell>
  );
}
