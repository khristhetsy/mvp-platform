"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

/**
 * Readiness estimator (spec §5, Step 5) — non-AI. Sliders recompute a weighted
 * estimate live using the published rubric weightings. Keyboard-operable (native
 * range inputs); no animation, so it's fine under prefers-reduced-motion.
 * Indicative only — not the real rating (§13).
 */

type Dim = { label: string; weight: number; desc: string; value: number };

function bandFor(score: number): string {
  if (score >= 75) return "Strong";
  if (score >= 60) return "Solid";
  if (score >= 40) return "Developing";
  return "Early";
}

export function ReadinessEstimator({
  dimensions,
  cta,
  workOn,
  disclaimer,
}: {
  dimensions: readonly Dim[];
  cta: { label: string; href: string };
  workOn: string;
  disclaimer: string;
}) {
  const [values, setValues] = useState<number[]>(() => dimensions.map((d) => d.value));

  const { estimate, weakest } = useMemo(() => {
    const totalWeight = dimensions.reduce((a, d) => a + d.weight, 0) || 1;
    const weighted = dimensions.reduce((a, d, i) => a + values[i] * d.weight, 0);
    const est = Math.round(weighted / totalWeight);
    // Biggest drags = largest weighted shortfall from 100. A maxed-out dimension
    // has zero gap and is filtered out, so it can never surface here.
    const ranked = dimensions
      .map((d, i) => ({ label: d.label, gap: (100 - values[i]) * d.weight }))
      .filter((x) => x.gap > 0)
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 2)
      .map((x) => x.label);
    return { estimate: est, weakest: ranked };
  }, [values, dimensions]);

  return (
    <div className="grid gap-8 md:grid-cols-[2fr_1fr]">
      <div className="space-y-5">
        {dimensions.map((d, i) => (
          <div key={d.label}>
            <div className="flex items-center justify-between text-[13px]">
              <span className="font-medium text-site-navy">{d.label} <span className="font-site-mono text-site-muted">Weight {d.weight}%</span></span>
              <span className="font-site-mono text-site-blue">{values[i]}</span>
            </div>
            <div className="mt-1 text-[12px] text-site-muted">{d.desc}</div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={values[i]}
              aria-label={`${d.label} — 0 to 100`}
              onChange={(e) => setValues((prev) => { const next = [...prev]; next[i] = Number(e.target.value); return next; })}
              className="mt-2 w-full accent-site-blue"
            />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-site-line bg-white p-6 text-center" role="status" aria-live="polite">
        <div className="font-site-mono text-xs uppercase tracking-wider text-site-muted">Estimated rating</div>
        <div className="mt-2 font-site-display text-5xl font-extrabold text-site-blue">{estimate}<span className="text-lg text-site-muted">/100</span></div>
        <div className="text-sm text-site-muted">{bandFor(estimate)}</div>
        {weakest.length > 0 && (
          <>
            <div className="mt-4 font-site-mono text-[11px] uppercase tracking-wider text-site-muted">{workOn}</div>
            <ul className="mt-2 space-y-1 text-[13px] text-site-ink">
              {weakest.map((w) => (<li key={w}>{w}</li>))}
            </ul>
          </>
        )}
        <Link href={cta.href} className="mt-4 block rounded-lg bg-site-blue px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi">{cta.label}</Link>
        <p className="mt-3 font-site-mono text-[10px] leading-4 text-site-muted/70">{disclaimer}</p>
      </div>
    </div>
  );
}
