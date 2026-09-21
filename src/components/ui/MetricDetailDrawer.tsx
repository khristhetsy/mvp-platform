"use client";

import { useState } from "react";
import Link from "next/link";

export type MetricBreakdownRow = { label: string; value: string; tone?: "good" | "warn" | "bad" };

export type MetricDetail = {
  /** Rows that make up the number — the breakdown the tile can't fit. */
  breakdown?: MetricBreakdownRow[];
  /** Where to go to act on it. */
  href?: string;
  hrefLabel?: string;
  /** Extra context shown above the breakdown. */
  note?: string;
};

/**
 * Detail panel for a metric tile.
 *
 * Lifted out of FounderReadinessDonutCards so the drawer stops being a feature
 * only two components have. The AI explanation is fetched on open, never on
 * render — 200 tiles firing a completion on page load would be both slow and
 * pointless, since most are never looked at.
 */
export function MetricDetailDrawer({
  open,
  onClose,
  label,
  value,
  unit,
  detail,
  flag,
  audience = "admin",
  extra,
}: Readonly<{
  open: boolean;
  onClose: () => void;
  label: string;
  value: string;
  unit?: string;
  detail?: string;
  flag?: { text: string; tone?: "good" | "warn" | "bad" } | null;
  audience?: "admin" | "founder" | "investor";
  extra?: MetricDetail;
}>) {
  const [ai, setAi] = useState<{ state: "idle" | "loading" | "done"; text: string | null }>({
    state: "idle",
    text: null,
  });

  async function explain() {
    setAi({ state: "loading", text: null });
    try {
      const res = await fetch("/api/metrics/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, value, unit, detail, flag: flag?.text, audience }),
      });
      const j = await res.json().catch(() => ({}));
      setAi({ state: "done", text: typeof j.text === "string" ? j.text : null });
    } catch {
      setAi({ state: "done", text: null });
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal
      aria-label={label}
    >
      <div className="w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5" style={{ maxHeight: "70vh" }}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-slate-950">{value}</p>
            {unit ? <p className="mt-0.5 text-xs text-slate-500">{unit}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-50"
            aria-label="Close"
          >
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        {detail ? <p className="text-[12.5px] leading-relaxed text-slate-600">{detail}</p> : null}
        {flag ? (
          <p
            className={`mt-1.5 text-[12px] ${
              flag.tone === "bad" ? "text-red-700" : flag.tone === "good" ? "text-emerald-700" : "text-amber-700"
            }`}
          >
            {flag.tone === "good" ? "✓ " : "⚠ "}
            {flag.text}
          </p>
        ) : null}

        {extra?.note ? <p className="mt-3 text-[12.5px] leading-relaxed text-slate-600">{extra.note}</p> : null}

        {extra?.breakdown?.length ? (
          <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
            {extra.breakdown.map((r) => (
              <div
                key={r.label}
                className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 text-[12.5px] last:border-b-0"
              >
                <span className="text-slate-600">{r.label}</span>
                <span
                  className={`font-semibold tabular-nums ${
                    r.tone === "bad" ? "text-red-700" : r.tone === "good" ? "text-emerald-700" : r.tone === "warn" ? "text-amber-700" : "text-slate-900"
                  }`}
                >
                  {r.value}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {/* AI on demand. Nothing is fetched until asked. */}
        <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50/60 p-3">
          {ai.state === "idle" ? (
            <button
              type="button"
              onClick={explain}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 hover:underline"
            >
              <i className="ti ti-sparkles" aria-hidden="true" /> What does this mean?
            </button>
          ) : ai.state === "loading" ? (
            <p className="text-xs text-indigo-700">Reading the numbers…</p>
          ) : ai.text ? (
            <p className="text-[12.5px] leading-relaxed text-indigo-900">{ai.text}</p>
          ) : (
            <p className="text-xs text-slate-500">
              No explanation available — this metric has no supporting detail to read.
            </p>
          )}
        </div>

        {extra?.href ? (
          <Link
            href={extra.href}
            onClick={onClose}
            className="mt-4 inline-flex rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            {extra.hrefLabel ?? "Open"} →
          </Link>
        ) : null}
      </div>
    </div>
  );
}
