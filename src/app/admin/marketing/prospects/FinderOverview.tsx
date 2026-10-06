"use client";

// Contact finder overview (spec 5.4, mockup screen 1). Every figure comes from
// contact_lookups / contact_finder_suggestions for the last 30 days. Find rate
// per source = found / (found + not found); skips and errors are not attempts.

import { useEffect, useState } from "react";
import { MetricCard } from "@/components/MetricCard";

type SourceStat = { source: string; label: string; found: number; notFound: number; attempts: number; rate: number | null };
type Stats = {
  sinceIso: string; days: number; lookups: number; contactsLookedUp: number; bySource: SourceStat[];
  pendingSuggestions: number; acceptedSuggestions: number; rejectedSuggestions: number; error?: string;
};

const pct = (r: number) => `${Math.round(r * 100)}%`;

export function FinderOverview() {
  const [s, setS] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/prospects/finder-stats?days=30")
      .then(async (r) => { const j = await r.json(); if (!live) return; if (!r.ok) setError(j.error ?? "Could not load stats."); else setS(j); })
      .catch(() => { if (live) setError("Could not load stats."); });
    return () => { live = false; };
  }, []);

  if (error) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
        Finder stats aren&apos;t available yet: {error} They appear once the contact finder v2 migration has run and lookups have been made.
      </p>
    );
  }
  if (!s) return <p className="text-xs text-slate-500">Loading finder stats…</p>;

  const decided = s.acceptedSuggestions + s.rejectedSuggestions;
  const provenance = `Last ${s.days} days, from the lookup log`;

  return (
    <section className="space-y-3">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-slate-400">Contact finder · last {s.days} days</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 [&>*]:h-full">
        <MetricCard
          label="Lookups"
          value={s.lookups.toLocaleString()}
          detail={`${s.contactsLookedUp.toLocaleString()} contacts looked up · ${provenance}`}
          ring={{ percent: null, pending: true }}
        />
        <MetricCard
          label="Waiting for review"
          value={s.pendingSuggestions.toLocaleString()}
          detail={`${s.acceptedSuggestions} accepted, ${s.rejectedSuggestions} rejected in the same period`}
          ring={{ percent: null, pending: true }}
          flag={s.pendingSuggestions > 0 ? { text: "Review them in Verify & correct", tone: "warn" } : null}
        />
        <MetricCard
          label="Acceptance rate"
          value={decided ? pct(s.acceptedSuggestions / decided) : "Not measured"}
          unit={decided ? `of ${decided} decided` : undefined}
          detail={decided ? "Suggestions accepted out of those reviewed" : "No suggestions reviewed yet"}
          ring={decided ? { percent: Math.round((s.acceptedSuggestions / decided) * 100) } : { percent: null, pending: true }}
        />
        {s.bySource.length === 0 ? (
          <MetricCard label="Find rate by source" value="Not measured" detail="No lookups logged yet. Run Find missing info on a few contacts." ring={{ percent: null, pending: true }} />
        ) : null}
      </div>
      {s.bySource.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 [&>*]:h-full">
          {s.bySource.map((b) => (
            <MetricCard
              key={b.source}
              label={`Find rate · ${b.label}`}
              value={b.rate === null ? "Not measured" : pct(b.rate)}
              unit={`of ${b.attempts}`}
              detail={`${b.found} found, ${b.notFound} not found · ${provenance}`}
              ring={b.rate === null ? { percent: null, pending: true } : { percent: Math.round(b.rate * 100) }}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
