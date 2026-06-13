"use client";

/**
 * AdminReadinessDashboard
 *
 * Interactive admin view for Investable Readiness Scores.
 * - Company table with scores, flags, re-score & override actions
 * - Override panel (select a row to edit)
 * - Score distribution bar chart
 * - Factor breakdown popup (click any factor)
 */

import { useState, useTransition } from "react";
import { READINESS_FACTORS } from "@/lib/ai/readiness-scoring";
import type { FactorKey, FactorScore } from "@/lib/ai/readiness-scoring";

// ─── Types ────────────────────────────────────────────────────────────────────

type CompanyScore = {
  id: string;
  totalScore: number;
  effectiveScore: number;
  overrideScore: number | null;
  overrideReason: string | null;
  overriddenBy: string | null;
  overriddenAt: string | null;
  factorScores: Record<string, unknown>;
  scoredBy: string;
  documentCount: number;
  outreachUnlocked: boolean;
  scoredAt: string;
};

type Row = {
  companyId: string;
  companyName: string;
  industry: string | null;
  status: string | null;
  score: CompanyScore | null;
};

type Metrics = {
  totalCompanies: number;
  totalScored: number;
  outreachUnlocked: number;
  avgScore: number;
  overrideCount: number;
};

type Props = {
  rows: Row[];
  metrics: Metrics;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(n: number): string {
  if (n >= 75) return "#1D9E75";
  if (n >= 50) return "#E8922A";
  return "#D9534F";
}

function scoreBadgeClass(n: number): string {
  if (n >= 75) return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  if (n >= 50) return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  return "bg-red-50 text-red-700 ring-1 ring-red-200";
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
}

function distributionBuckets(rows: Row[]) {
  const buckets = [0, 0, 0, 0, 0]; // 0-29, 30-49, 50-69, 70-84, 85-100
  for (const r of rows) {
    if (!r.score) continue;
    const s = r.score.effectiveScore;
    if (s < 30) buckets[0]++;
    else if (s < 50) buckets[1]++;
    else if (s < 70) buckets[2]++;
    else if (s < 85) buckets[3]++;
    else buckets[4]++;
  }
  return buckets;
}

// ─── Factor popup ─────────────────────────────────────────────────────────────

function FactorPopup({
  factorKey,
  score,
  onClose,
}: {
  factorKey: FactorKey;
  score: FactorScore;
  onClose: () => void;
}) {
  const def = READINESS_FACTORS.find((f) => f.key === factorKey)!;
  const pct = score.pts / score.max;

  const color =
    pct >= 0.75 ? "#1D9E75" : pct >= 0.45 ? "#E8922A" : "#D9534F";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-lg max-h-[82vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-6 py-4">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
          >
            ✕
          </button>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
            {def.tag}
          </p>
          <h2 className="mt-1 text-base font-semibold text-slate-950">{def.label}</h2>
          <p className="text-xs text-slate-400">
            {score.pts} / {score.max} pts · {score.rating}
          </p>
        </div>

        <div className="space-y-5 px-6 py-5">
          {/* Score bar */}
          <div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-4xl font-semibold" style={{ color }}>
                {score.pts}
              </span>
              <span className="text-lg text-slate-400">/ {score.max}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ml-1 ${
                  score.rating === "Strong"
                    ? "bg-emerald-50 text-emerald-700"
                    : score.rating === "Developing"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {score.rating}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct * 100}%`, background: color }}
              />
            </div>
          </div>

          {/* AI Analysis */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              AI Analysis
            </p>
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-600">
              {score.aiSummary || "No analysis available."}
            </div>
          </div>

          {/* Sub-scores */}
          {score.subScores.length > 0 && (
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Sub-scores
              </p>
              <div className="space-y-2">
                {score.subScores.map((s) => (
                  <div key={s.label} className="flex items-center gap-3">
                    <span className="w-36 shrink-0 text-xs text-slate-500">{s.label}</span>
                    <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(s.pts / s.max) * 100}%`,
                          background: color,
                        }}
                      />
                    </div>
                    <span className="w-10 text-right text-xs font-medium text-slate-700">
                      {s.pts}/{s.max}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Evidence */}
          {score.evidence.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Evidence from documents
              </p>
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                {score.evidence.map((e, i) => (
                  <div key={i} className="flex gap-3 px-4 py-3">
                    <span className="mt-0.5 shrink-0">{e.icon}</span>
                    <div>
                      <p className="text-sm text-slate-700">{e.text}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{e.src}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Flags */}
          {score.flags.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Flags
              </p>
              <div className="space-y-2">
                {score.flags.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-xl bg-slate-50 px-4 py-3"
                  >
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        f.severity === "red"
                          ? "bg-red-50 text-red-700"
                          : f.severity === "amber"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {f.label}
                    </span>
                    <p className="text-xs leading-relaxed text-slate-500">{f.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 border-t border-slate-100 bg-white px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Override panel ───────────────────────────────────────────────────────────

function OverridePanel({
  row,
  onSaved,
  onCancel,
}: {
  row: Row;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [overrideScore, setOverrideScore] = useState<string>(
    String(row.score?.overrideScore ?? row.score?.effectiveScore ?? ""),
  );
  const [reason, setReason] = useState(row.score?.overrideReason ?? "");
  const [clearing, setClearing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!row.score) return null;

  async function submit(clear = false) {
    setError(null);
    if (clear) setClearing(true);

    const body = clear
      ? { scoreId: row.score!.id, overrideScore: null, overrideReason: null }
      : {
          scoreId: row.score!.id,
          overrideScore: parseInt(overrideScore, 10),
          overrideReason: reason.trim() || null,
        };

    if (!clear && (isNaN(body.overrideScore as number) || (body.overrideScore as number) < 0 || (body.overrideScore as number) > 100)) {
      setError("Score must be 0–100.");
      setClearing(false);
      return;
    }

    const res = await fetch("/api/admin/readiness-score/override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setClearing(false);

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Failed to save override.");
      return;
    }

    startTransition(() => {
      onSaved();
    });
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">{row.companyName}</p>
          <p className="mt-0.5 text-xs text-slate-400">Override panel</p>
        </div>
        <button
          onClick={onCancel}
          className="text-xs text-slate-400 hover:text-slate-600"
        >
          Cancel
        </button>
      </div>

      <div className="mb-4 divide-y divide-slate-100 rounded-xl border border-slate-100 text-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-slate-500">AI score (raw)</span>
          <span className="font-medium">{row.score.totalScore}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-slate-500">Current effective score</span>
          <span className="font-semibold text-slate-900">{row.score.effectiveScore}</span>
        </div>
        {row.score.overriddenBy && (
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-slate-500">Last override by</span>
            <span className="text-slate-700">{row.score.overriddenBy}</span>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-600">
            Override score (0–100)
          </label>
          <input
            type="number"
            min={0}
            max={100}
            value={overrideScore}
            onChange={(e) => setOverrideScore(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            placeholder="Enter score…"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-600">
            Reason (required for audit log)
          </label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            placeholder="e.g. Strong in-person pitch; AI missed verbal traction evidence."
          />
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => submit(false)}
          disabled={isPending}
          className="flex-1 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPending ? "Saving…" : "Save override"}
        </button>
        {row.score.overrideScore !== null && (
          <button
            onClick={() => submit(true)}
            disabled={clearing}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            {clearing ? "Clearing…" : "Clear override"}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Distribution chart ───────────────────────────────────────────────────────

function DistributionChart({ rows }: { rows: Row[] }) {
  const buckets = distributionBuckets(rows);
  const labels = ["0–29", "30–49", "50–69", "70–84", "85–100"];
  const colors = ["#F09595", "#FAC775", "#85B7EB", "#5DCAA5", "#1D9E75"];
  const maxVal = Math.max(...buckets, 1);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="mb-1 text-sm font-semibold text-slate-900">Score distribution</p>
      <p className="mb-4 text-xs text-slate-400">{rows.filter((r) => r.score).length} scored companies</p>
      <div className="flex h-28 items-end gap-2">
        {buckets.map((val, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-xs font-medium text-slate-600">{val}</span>
            <div
              className="w-full rounded-t-md transition-all"
              style={{
                height: `${(val / maxVal) * 80}px`,
                background: colors[i],
                minHeight: val > 0 ? "4px" : "0",
              }}
            />
            <span className="text-[10px] text-slate-400">{labels[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AdminReadinessDashboard({ rows, metrics }: Props) {
  const [filter, setFilter] = useState<"all" | "unlocked" | "locked" | "overridden">("all");
  const [search, setSearch] = useState("");
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);
  const [activeFactor, setActiveFactor] = useState<{
    key: FactorKey;
    score: FactorScore;
  } | null>(null);
  const [rescoring, setRescoring] = useState<string | null>(null);
  const [rescoreError, setRescoreError] = useState<string | null>(null);
  const [rescoreAllProgress, setRescoreAllProgress] = useState<{ done: number; total: number } | null>(null);

  const filtered = rows.filter((r) => {
    const matchSearch =
      search.trim() === "" ||
      r.companyName.toLowerCase().includes(search.toLowerCase());

    const matchFilter =
      filter === "all"
        ? true
        : filter === "unlocked"
        ? r.score?.outreachUnlocked === true
        : filter === "locked"
        ? !r.score?.outreachUnlocked
        : filter === "overridden"
        ? r.score?.overrideScore !== null && r.score?.overrideScore !== undefined
        : true;

    return matchSearch && matchFilter;
  });

  async function rescoreAll() {
    // Re-score companies that are unscored or have a demo/unconfigured score
    const targets = rows.filter(
      (r) => r.score === null || r.score.scoredBy === "unconfigured" || r.score.scoredBy === "claude",
    );
    if (targets.length === 0) return;

    setRescoreAllProgress({ done: 0, total: targets.length });
    setRescoreError(null);

    for (let i = 0; i < targets.length; i++) {
      try {
        const res = await fetch("/api/ai/readiness-score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyId: targets[i].companyId }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setRescoreError(j.error ?? "Re-score All failed.");
          setRescoreAllProgress(null);
          return;
        }
      } catch {
        setRescoreError("Network error during Re-score All.");
        setRescoreAllProgress(null);
        return;
      }
      setRescoreAllProgress({ done: i + 1, total: targets.length });
    }

    setRescoreAllProgress(null);
    window.location.reload();
  }

  async function rescore(companyId: string) {
    setRescoring(companyId);
    setRescoreError(null);
    try {
      const res = await fetch("/api/ai/readiness-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setRescoreError(j.error ?? "Re-score failed.");
      } else {
        // Reload page to show updated score
        window.location.reload();
      }
    } catch {
      setRescoreError("Network error during re-score.");
    } finally {
      setRescoring(null);
    }
  }

  function openFactor(companyScore: CompanyScore, factorKey: string) {
    const fs = companyScore.factorScores?.[factorKey] as FactorScore | undefined;
    if (!fs) return;
    setActiveFactor({ key: factorKey as FactorKey, score: fs });
  }

  return (
    <>
      {/* Metric cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Companies scored", value: `${metrics.totalScored} / ${metrics.totalCompanies}` },
          { label: "Outreach unlocked", value: metrics.outreachUnlocked, accent: "text-emerald-600" },
          { label: "Avg score", value: metrics.avgScore },
          { label: "Admin overrides", value: metrics.overrideCount, accent: "text-amber-600" },
          { label: "Not yet scored", value: metrics.totalCompanies - metrics.totalScored, accent: "text-slate-400" },
        ].map(({ label, value, accent }) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium text-slate-400">{label}</p>
            <p className={`mt-1 text-3xl font-semibold ${accent ?? "text-slate-900"}`}>
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Left: table + override panel */}
        <div className="space-y-5">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Search company…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            >
              <option value="all">All companies</option>
              <option value="unlocked">Outreach unlocked</option>
              <option value="locked">Outreach locked</option>
              <option value="overridden">Admin overridden</option>
            </select>
            <button
              onClick={rescoreAll}
              disabled={rescoreAllProgress !== null}
              className="ml-auto rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {rescoreAllProgress
                ? `Scoring ${rescoreAllProgress.done} / ${rescoreAllProgress.total}…`
                : "Re-score All"}
            </button>
          </div>

          {rescoreError && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {rescoreError}
            </div>
          )}

          {/* Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Company
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Score
                  </th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 lg:table-cell">
                    Factors
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Outreach
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                      No companies match your filter.
                    </td>
                  </tr>
                )}
                {filtered.map((row) => {
                  const s = row.score;
                  const isSelected = selectedRow?.companyId === row.companyId;

                  return (
                    <tr
                      key={row.companyId}
                      className={`cursor-pointer transition-colors hover:bg-slate-50 ${isSelected ? "bg-indigo-50" : ""}`}
                      onClick={() => setSelectedRow(isSelected ? null : row)}
                    >
                      {/* Company */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-xs font-semibold text-indigo-600">
                            {initials(row.companyName)}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{row.companyName}</p>
                            {row.industry && (
                              <p className="text-xs text-slate-400">{row.industry}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Score */}
                      <td className="px-4 py-3">
                        {s ? (
                          <div>
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${scoreBadgeClass(s.effectiveScore)}`}
                            >
                              {s.effectiveScore}
                            </span>
                            {s.overrideScore !== null && (
                              <span className="ml-1.5 rounded-full bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-600">
                                Override
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Not scored</span>
                        )}
                      </td>

                      {/* Factor mini-bars */}
                      <td className="hidden px-4 py-3 lg:table-cell">
                        {s?.factorScores ? (
                          <div className="flex gap-1.5">
                            {READINESS_FACTORS.map((f) => {
                              const fs = s.factorScores[f.key] as FactorScore | undefined;
                              if (!fs) return null;
                              const pct = fs.pts / fs.max;
                              const col =
                                pct >= 0.75 ? "#1D9E75" : pct >= 0.45 ? "#E8922A" : "#D9534F";
                              return (
                                <button
                                  key={f.key}
                                  title={`${f.label}: ${fs.pts}/${fs.max}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openFactor(s, f.key);
                                  }}
                                  className="group relative flex flex-col items-center gap-0.5"
                                >
                                  <div className="h-6 w-3 overflow-hidden rounded-sm bg-slate-100">
                                    <div
                                      className="w-full rounded-sm transition-all group-hover:opacity-80"
                                      style={{
                                        height: `${pct * 100}%`,
                                        background: col,
                                        marginTop: `${(1 - pct) * 100}%`,
                                      }}
                                    />
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>

                      {/* Outreach */}
                      <td className="px-4 py-3">
                        {s ? (
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              s.outreachUnlocked
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {s.outreachUnlocked ? "Unlocked" : "Locked"}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              rescore(row.companyId);
                            }}
                            disabled={rescoring === row.companyId}
                            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                          >
                            {rescoring === row.companyId ? "Scoring…" : "Re-score"}
                          </button>
                          {s && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRow(isSelected ? null : row);
                              }}
                              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
                            >
                              Override
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Override panel (shown below table when a row is selected) */}
          {selectedRow && selectedRow.score && (
            <OverridePanel
              row={selectedRow}
              onSaved={() => {
                setSelectedRow(null);
                window.location.reload();
              }}
              onCancel={() => setSelectedRow(null)}
            />
          )}
        </div>

        {/* Right: distribution chart */}
        <div className="space-y-5">
          <DistributionChart rows={rows} />

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="mb-3 text-sm font-semibold text-slate-900">Legend</p>
            <div className="space-y-2 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Score 75–100 · Strong
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Score 50–74 · Developing
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-400" />
                Score 0–49 · Needs Work
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-400" />
                Admin override active
              </div>
            </div>
            <div className="mt-4 border-t border-slate-100 pt-4 text-xs text-slate-400">
              Scores ≥ 65 automatically unlock investor outreach.
              Override takes precedence over AI score.
            </div>
          </div>
        </div>
      </div>

      {/* Factor popup */}
      {activeFactor && (
        <FactorPopup
          factorKey={activeFactor.key}
          score={activeFactor.score}
          onClose={() => setActiveFactor(null)}
        />
      )}
    </>
  );
}
