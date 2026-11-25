"use client";

import { useState } from "react";
import Link from "next/link";
import { MetricChart, type MetricChartData } from "@/components/ui/MetricChart";

export type MetricBreakdownRow = {
  label: string;
  value: string;
  tone?: "good" | "warn" | "bad";
  /** A second, smaller line under the label (who, when, status). */
  sub?: string;
  /** Makes the row a link to the record it stands for. */
  href?: string;
};

export type MetricDetail = {
  /** Rows that make up the number — the breakdown the tile can't fit. */
  breakdown?: MetricBreakdownRow[];
  /** Where to go to act on it. */
  href?: string;
  hrefLabel?: string;
  /** Extra context shown above the breakdown. */
  note?: string;
  /** A graph of recent readings, shown under the note. Optional. */
  chart?: MetricChartData;
  /** The records behind the number. Each row opens its own page. */
  records?: MetricRecord[];
  recordsLabel?: string;
  /** Shown under the records, e.g. "15 more in Compliance". */
  recordsMore?: string;
  /** Shown instead of the records when there are none, or when they could not be read. */
  recordsEmpty?: string;
  /** Text of the AI button. */
  explainLabel?: string;
};

/** One record opened inside the drawer. Never carries tokens, secrets or message bodies. */
export type MetricTransaction = {
  id: string;
  status: string;
  attempts: string;
  lastSuccess: string;
  lastFailure: string;
  /** Null when the audit trail could not be read. */
  audit: { at: string; text: string }[] | null;
};

/** With a transaction the row opens it in the drawer. Without one it links to href. */
export type MetricRecord = { label: string; sub?: string; href: string; transaction?: MetricTransaction };

function TransactionView({ record, transaction: t, onBack, onClose }: Readonly<{ record: MetricRecord; transaction: MetricTransaction; onBack: () => void; onClose: () => void }>) {
  const rows = [
    ["Record ID", t.id],
    ["Status", t.status],
    ["Attempts", t.attempts],
    ["Last success", t.lastSuccess],
    ["Last failure", t.lastFailure],
  ];
  return (
    <>
      <button type="button" onClick={onBack} className="text-xs font-semibold text-indigo-700 hover:underline">← Back</button>
      <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 text-[12.5px] last:border-b-0">
            <span className="flex-none text-slate-600">{label}</span>
            <span className="min-w-0 break-all text-right font-semibold text-slate-900">{value}</span>
          </div>
        ))}
      </div>
      <p className="mb-1.5 mt-4 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Audit trail</p>
      {t.audit === null ? (
        <p className="text-[12.5px] text-slate-500">The audit trail could not be read.</p>
      ) : t.audit.length === 0 ? (
        <p className="text-[12.5px] text-slate-500">No audit entries recorded.</p>
      ) : (
        <ul className="space-y-1.5 text-[12.5px]">
          {t.audit.map((a, i) => (
            <li key={`${a.at}-${i}`} className="flex justify-between gap-3">
              <span className="text-slate-700">{a.text}</span>
              <span className="flex-none text-slate-500">{a.at}</span>
            </li>
          ))}
        </ul>
      )}
      <Link href={record.href} onClick={onClose} className="mt-4 inline-flex rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700">
        Open full transaction →
      </Link>
    </>
  );
}

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
  const [record, setRecord] = useState<MetricRecord | null>(null);

  function close() {
    setRecord(null);
    onClose();
  }

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
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
      role="dialog"
      aria-modal
      aria-label={label}
    >
      <div className="w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5" style={{ maxHeight: "70vh" }}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</p>
            <p className={record ? "mt-1 text-base font-semibold text-slate-950" : "mt-1 font-mono text-2xl font-semibold tabular-nums text-slate-950"}>{record ? record.label : value}</p>
            {!record && unit ? <p className="mt-0.5 text-xs text-slate-500">{unit}</p> : null}
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-50"
            aria-label="Close"
          >
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        {record?.transaction ? <TransactionView record={record} transaction={record.transaction} onBack={() => setRecord(null)} onClose={close} /> : (<>
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

        {extra?.chart ? <MetricChart data={extra.chart} /> : null}

        {extra?.breakdown?.length ? (
          <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
            {extra.breakdown.map((r, i) => {
              const inner = (
                <>
                  <span className="min-w-0 text-slate-600">
                    <span className="block truncate">{r.label}</span>
                    {r.sub ? <span className="block truncate text-[11px] text-slate-400">{r.sub}</span> : null}
                  </span>
                  <span
                    className={`flex-none font-semibold tabular-nums ${
                      r.tone === "bad" ? "text-red-700" : r.tone === "good" ? "text-emerald-700" : r.tone === "warn" ? "text-amber-700" : "text-slate-900"
                    }`}
                  >
                    {r.value}
                    {r.href ? <span className="ml-2 text-indigo-600">→</span> : null}
                  </span>
                </>
              );
              const cls = "flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 text-[12.5px] last:border-b-0";
              return r.href ? (
                <Link key={`${r.label}-${i}`} href={r.href} onClick={onClose} className={`${cls} hover:bg-slate-50`}>
                  {inner}
                </Link>
              ) : (
                <div key={`${r.label}-${i}`} className={cls}>{inner}</div>
              );
            })}
          </div>
        ) : null}

        {extra?.records?.length ? (
          <div className="mt-4">
            {extra.recordsLabel ? <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">{extra.recordsLabel}</p> : null}
            <div className="space-y-1.5">
              {extra.records.map((r) => {
                const cls = "flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-left hover:border-indigo-300 hover:bg-indigo-50/40";
                const inner = (
                  <>
                    <span className="min-w-0">
                      <span className="block truncate text-[12.5px] font-semibold text-slate-900">{r.label}</span>
                      {r.sub ? <span className="block truncate text-[11.5px] text-slate-500">{r.sub}</span> : null}
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-indigo-700">Open →</span>
                  </>
                );
                return r.transaction ? (
                  <button key={`${r.transaction.id}|${r.label}`} type="button" onClick={() => setRecord(r)} className={cls}>{inner}</button>
                ) : (
                  <Link key={`${r.href}|${r.label}`} href={r.href} onClick={onClose} className={cls}>{inner}</Link>
                );
              })}
            </div>
            {extra.recordsMore ? <p className="mt-1.5 text-[11.5px] text-slate-500">{extra.recordsMore}</p> : null}
          </div>
        ) : extra?.recordsEmpty ? (
          <p className="mt-4 rounded-lg border border-dashed border-slate-200 px-3 py-3 text-center text-[12.5px] text-slate-500">{extra.recordsEmpty}</p>
        ) : null}

        {/* AI on demand. Nothing is fetched until asked. */}
        <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50/60 p-3">
          {ai.state === "idle" ? (
            <button
              type="button"
              onClick={explain}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 hover:underline"
            >
              <i className="ti ti-sparkles" aria-hidden="true" /> {extra?.explainLabel ?? "What does this mean?"}
            </button>
          ) : ai.state === "loading" ? (
            <p className="text-xs text-indigo-700">Reading the numbers…</p>
          ) : ai.text ? (
            <p className="text-[12.5px] leading-relaxed text-indigo-900">{ai.text}</p>
          ) : (
            <p className="text-xs text-slate-500">
              No explanation available. The AI service is off or this metric has no detail to read.
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
        </>)}
      </div>
    </div>
  );
}
