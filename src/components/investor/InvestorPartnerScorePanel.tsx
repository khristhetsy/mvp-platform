"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Sparkles, Lock, ArrowUpRight, ChevronUp, X } from "lucide-react";
import type { PartnerScore, PartnerTier } from "@/lib/investor-rating/types";
import { TIER_LABELS } from "@/lib/investor-rating/types";
import type { PartnerCoaching } from "@/lib/investor-rating/coaching";

const TIER_CLASS: Record<string, string> = {
  premier: "bg-emerald-50 text-emerald-700",
  established: "bg-indigo-50 text-indigo-700",
  active: "bg-amber-50 text-amber-800",
  emerging: "bg-slate-100 text-slate-600",
  new: "bg-slate-100 text-slate-500",
};

const PILLARS: Array<{ key: keyof PartnerScore["pillars"]; label: string; weight: string }> = [
  { key: "followThrough", label: "Follow-through", weight: "35%" },
  { key: "responsiveness", label: "Responsiveness", weight: "25%" },
  { key: "credibility", label: "Credibility", weight: "20%" },
  { key: "portfolioReadiness", label: "Portfolio readiness", weight: "10%" },
  { key: "trackRecord", label: "Track record", weight: "10%" },
];

function barColor(value: number): string {
  if (value >= 70) return "bg-emerald-500";
  if (value >= 40) return "bg-amber-500";
  return "bg-rose-400";
}

function valueColor(value: number): string {
  if (value >= 70) return "text-emerald-600";
  if (value >= 40) return "text-amber-600";
  return "text-rose-500";
}

type DrawerRow = { label: string; value: string; highlight?: boolean };
type DrawerDetail = { title: string; chip?: string; explain: string; rows: DrawerRow[] };

const pct = (x: number) => `${Math.round(x * 100)}%`;

function replyText(hours: number | null): string {
  if (hours === null) return "Not enough data";
  if (hours < 1) return "under 1 hour";
  if (hours < 48) return `~${Math.round(hours)}h`;
  return `~${Math.round(hours / 24)}d`;
}

function lastActiveText(days: number | null): string {
  if (days === null) return "—";
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

const TIER_LADDER: Array<{ tier: PartnerTier; band: string }> = [
  { tier: "emerging", band: "under 40" },
  { tier: "active", band: "40 – 59" },
  { tier: "established", band: "60 – 79" },
  { tier: "premier", band: "80 +" },
];

/** Build every drawer's content from the already-computed score — no new data. */
function buildDetails(score: PartnerScore): Record<string, DrawerDetail> {
  const f = score.facts;
  const p = score.pillars;
  const accreditedValue = f.accredited ? "Verified" : "Not verified";
  const readiness = f.backedReadinessAvg === null ? "No backed companies yet" : `${Math.round(f.backedReadinessAvg)} / 100`;

  const tierLadderRows: DrawerRow[] = TIER_LADDER.map((t) => ({
    label: t.tier === score.tier ? `${TIER_LABELS[t.tier]} — you` : TIER_LABELS[t.tier],
    value: t.band,
    highlight: t.tier === score.tier,
  }));

  return {
    score: {
      title: "Partner Score",
      chip: `${score.score} / 100`,
      explain:
        "A single measure of how reliably and broadly you partner with founders, blended from the five drivers below. It's weighted toward follow-through and responsiveness — the things founders feel most.",
      rows: [
        { label: "Follow-through", value: "35% of score" },
        { label: "Responsiveness", value: "25% of score" },
        { label: "Credibility", value: "20% of score" },
        { label: "Portfolio readiness", value: "10% of score" },
        { label: "Track record", value: "10% of score" },
      ],
    },
    p_followThrough: {
      title: "Follow-through",
      chip: `${Math.round(p.followThrough)} / 100 · 35% of score`,
      explain:
        "Turning interest into committed action — opening deal rooms and honoring SPV pledges — minus founders you went quiet on. It's the heaviest driver.",
      rows: [
        { label: "Interest → deal room", value: pct(f.conversionRate) },
        { label: "Pledges honored", value: pct(f.pledgeHonorRate) },
        { label: "Founders gone quiet on", value: pct(f.ghostRate), highlight: f.ghostRate > 0 },
      ],
    },
    p_responsiveness: {
      title: "Responsiveness",
      chip: `${Math.round(p.responsiveness)} / 100 · 25% of score`,
      explain:
        "How reliably and quickly you reply to founders who reach out — weighted toward recent activity, so going quiet costs you.",
      rows: [
        { label: "Reply rate", value: pct(f.replyRate) },
        { label: "Typical reply time", value: replyText(f.medianResponseHours) },
        { label: "Last active", value: lastActiveText(f.daysSinceLastActive) },
      ],
    },
    p_credibility: {
      title: "Credibility",
      chip: `${Math.round(p.credibility)} / 100 · 20% of score`,
      explain:
        "Signals that you're a serious, verifiable partner — accreditation, a complete investor profile, and pledges that match your stated check size.",
      rows: [
        { label: "Accredited status", value: accreditedValue, highlight: !f.accredited },
        { label: "Also counts", value: "Profile completeness" },
        { label: "Also counts", value: "Check-size consistency" },
      ],
    },
    p_portfolioReadiness: {
      title: "Portfolio readiness",
      chip: `${Math.round(p.portfolioReadiness)} / 100 · 10% of score`,
      explain:
        "The average iCapOS readiness of companies you've backed. Deliberately light — backing rough early-stage companies isn't penalized.",
      rows: [{ label: "Avg backed readiness", value: readiness }],
    },
    p_trackRecord: {
      title: "Track record",
      chip: `${Math.round(p.trackRecord)} / 100 · 10% of score`,
      explain: "Grows with real outcomes — closed deals and your tenure on iCapOS.",
      rows: [
        { label: "Deals closed", value: String(f.closedDeals) },
        { label: "Also counts", value: "Time on the platform" },
      ],
    },
    f_tier: {
      title: "Tier",
      chip: TIER_LABELS[score.tier],
      explain:
        "Your tier is the band your score falls into — the headline founders see on your profile. They see the tier and your activity facts, never the underlying number.",
      rows: tierLadderRows,
    },
    f_reply: {
      title: "Typical reply time",
      chip: replyText(f.medianResponseHours),
      explain:
        "The median time you take to respond to a founder who reaches out — a plain-language signal of how reachable you are.",
      rows: [
        { label: "Median reply", value: replyText(f.medianResponseHours) },
        { label: "Reply rate", value: pct(f.replyRate) },
        { label: "Feeds", value: "Responsiveness (25%)" },
      ],
    },
    f_accredited: {
      title: "Accreditation",
      chip: accreditedValue,
      explain:
        "Whether your accredited-investor status is verified on iCapOS. Founders use it to gauge whether you can participate in a given round.",
      rows: [
        { label: "Status", value: accreditedValue, highlight: !f.accredited },
        { label: "Feeds", value: "Credibility (20%)" },
      ],
    },
  };
}

export function InvestorPartnerScorePanel({
  score,
  coaching,
}: Readonly<{
  score: PartnerScore;
  coaching: PartnerCoaching;
}>) {
  const t = useTranslations("investorCmp");
  const isNew = score.status === "new";
  const [openId, setOpenId] = useState<string | null>(null);
  // Remember the last-opened drawer so its content stays visible during the
  // slide-out transition after openId is cleared.
  const [lastId, setLastId] = useState<string | null>(null);
  const details = buildDetails(score);

  const open = (id: string) => {
    setLastId(id);
    setOpenId(id);
  };
  const close = () => setOpenId(null);
  const detail = lastId ? details[lastId] : null;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenId(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (openId) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [openId]);

  const dash = 263.9;
  const offset = score.score != null ? dash * (1 - score.score / 100) : dash;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-400">
            Your Partner Score
          </p>
          {isNew ? (
            <p className="mt-1 text-sm text-slate-600">
              Building history — {score.sampleSize} founder{score.sampleSize === 1 ? "" : "s"} engaged
            </p>
          ) : (
            <button
              type="button"
              onClick={() => open("score")}
              className="group mt-2 flex items-center gap-3.5 rounded-xl p-1 -m-1 text-left transition hover:bg-slate-50"
              aria-label={`Partner score ${score.score} out of 100 — show detail`}
            >
              <span className="relative inline-flex h-[68px] w-[68px] shrink-0 items-center justify-center">
                <svg viewBox="0 0 100 100" className="h-[68px] w-[68px] -rotate-90">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="9" className="text-slate-200" />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="9"
                    strokeLinecap="round"
                    strokeDasharray={dash}
                    strokeDashoffset={offset}
                    className="text-indigo-600"
                  />
                </svg>
                <span className="absolute text-lg font-semibold text-slate-900">{score.score}</span>
              </span>
              <span>
                <span className="flex items-baseline gap-1">
                  <span className="text-sm font-medium text-slate-700">out of 100</span>
                  <ChevronUp className="h-3.5 w-3.5 text-indigo-400 opacity-0 transition group-hover:opacity-100" strokeWidth={2} aria-hidden />
                </span>
                <span className="mt-0.5 block text-xs text-slate-400">tap for detail</span>
              </span>
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => !isNew && open("f_tier")}
          disabled={isNew}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${TIER_CLASS[score.tier] ?? TIER_CLASS.new} ${isNew ? "" : "hover:opacity-80"}`}
        >
          {TIER_LABELS[score.tier]}
        </button>
      </div>

      {/* Coaching summary */}
      <div className="mt-3.5 flex gap-2.5 rounded-lg bg-slate-50 px-3.5 py-3">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" strokeWidth={1.9} aria-hidden />
        <p className="text-[13px] leading-6 text-slate-600">{coaching.summary}</p>
      </div>

      {/* Pillars — clickable */}
      {!isNew ? (
        <div className="mt-4">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-400">
            What builds your score
          </p>
          <div>
            {PILLARS.map(({ key, label, weight }) => {
              const value = Math.round(score.pillars[key]);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => open(`p_${key}`)}
                  className="group -mx-2 block w-[calc(100%+1rem)] rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-50"
                >
                  <span className="flex items-baseline justify-between text-[13px]">
                    <span className="text-slate-600">
                      {label} <span className="text-[11px] text-slate-400">· {weight} of score</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className={`font-medium ${valueColor(value)}`}>{value}</span>
                      <ChevronUp className="h-3 w-3 text-indigo-400 opacity-0 transition group-hover:opacity-100" strokeWidth={2} aria-hidden />
                    </span>
                  </span>
                  <span className="mt-1 block h-1.5 rounded-full bg-slate-100">
                    <span className={`block h-1.5 rounded-full ${barColor(value)}`} style={{ width: `${value}%` }} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* What founders see — clickable facts */}
      {!isNew ? (
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-400">
            What founders see
          </p>
          <div className="grid grid-cols-3 gap-2">
            <FactCard label={t("tier")} value={TIER_LABELS[score.tier]} valueClass="text-indigo-700" onClick={() => open("f_tier")} />
            <FactCard label={t("typical_reply")} value={replyText(score.facts.medianResponseHours)} onClick={() => open("f_reply")} />
            <FactCard label={t("accredited")} value={score.facts.accredited ? "Yes" : "Not verified"} onClick={() => open("f_accredited")} />
          </div>
        </div>
      ) : null}

      {/* Improvement nudges */}
      {coaching.recommendations.length > 0 ? (
        <div className="mt-5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-400">
            Improve your score
          </p>
          <div className="space-y-2">
            {coaching.recommendations.map((rec) => (
              <div key={rec.title} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                <ArrowUpRight className="h-4 w-4 shrink-0 text-indigo-500" strokeWidth={1.9} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-slate-900">{rec.title}</p>
                  <p className="text-xs text-slate-500">{rec.detail}</p>
                </div>
                {rec.actionHref ? (
                  <Link href={rec.actionHref} className="shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-500">
                    {rec.actionLabel ?? "Open"} →
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <p className="mt-3.5 flex items-center gap-1.5 text-[11px] text-slate-400">
        <Lock className="h-3 w-3" strokeWidth={1.9} aria-hidden />
        Only you can see your score and these suggestions. Founders see your tier and activity facts.
      </p>

      {/* Bottom drawer */}
      <div className={`fixed inset-0 z-50 ${openId ? "" : "pointer-events-none"}`} aria-hidden={!openId}>
        <button
          type="button"
          aria-label="Close detail"
          tabIndex={openId ? 0 : -1}
          onClick={close}
          className={`absolute inset-0 bg-slate-900/40 transition-opacity duration-200 ${openId ? "opacity-100" : "opacity-0"}`}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label={detail?.title ?? "Detail"}
          className={`absolute inset-x-0 bottom-0 mx-auto max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-5 shadow-2xl transition-transform duration-300 ease-out ${openId ? "translate-y-0" : "translate-y-full"}`}
        >
          <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-slate-200" aria-hidden />
          {detail ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">{detail.title}</h3>
                  {detail.chip ? (
                    <span className="mt-1.5 inline-block rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                      {detail.chip}
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                >
                  <X className="h-4 w-4" strokeWidth={2} aria-hidden />
                </button>
              </div>
              <p className="mt-2.5 text-[13px] leading-6 text-slate-600">{detail.explain}</p>
              <dl className="mt-2">
                {detail.rows.map((row, i) => (
                  <div key={`${row.label}-${i}`} className="flex items-center justify-between gap-3 border-t border-slate-100 py-2.5">
                    <dt className="text-[13px] text-slate-500">{row.label}</dt>
                    <dd className={`text-[13px] font-medium ${row.highlight ? "text-indigo-600" : "text-slate-800"}`}>{row.value}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FactCard({
  label,
  value,
  valueClass,
  onClick,
}: Readonly<{ label: string; value: string; valueClass?: string; onClick: () => void }>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-lg border border-transparent bg-slate-50 p-2.5 text-left transition hover:border-indigo-200 hover:bg-white"
    >
      <span className="flex items-center gap-1 text-[11px] text-slate-500">
        {label}
        <ChevronUp className="h-3 w-3 text-indigo-400 opacity-0 transition group-hover:opacity-100" strokeWidth={2} aria-hidden />
      </span>
      <span className={`mt-1 block truncate text-sm font-medium ${valueClass ?? "text-slate-800"}`}>{value}</span>
    </button>
  );
}
