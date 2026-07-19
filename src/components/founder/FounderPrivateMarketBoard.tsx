"use client";

import { useState } from "react";
import { LayoutGrid } from "lucide-react";
import { useTranslations } from "next-intl";
import type { FounderInvestorRow, OutreachStatus } from "@/lib/founder/private-market";

const SIGIL: Record<string, string> = {
  high: "bg-[var(--teal-muted)] text-[var(--teal)]",
  mid: "bg-[var(--blue-muted)] text-[var(--blue-hover)]",
  low: "bg-slate-100 text-slate-400",
};
const PRICE: Record<string, string> = {
  high: "text-[var(--teal)]",
  mid: "text-[var(--navy)]",
  low: "text-slate-600",
};
const BAND_LABEL: Record<string, string> = { high: "Strong", mid: "Moderate", low: "Building" };

const OUTREACH_META: Record<OutreachStatus, { label: string; className: string; dot: string }> = {
  reached_out: { label: "Reached out", className: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  queued: { label: "Queued", className: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  skipped: { label: "Skipped", className: "bg-slate-100 text-slate-500", dot: "bg-slate-400" },
  none: { label: "Not contacted", className: "bg-slate-100 text-slate-500", dot: "bg-slate-300" },
};

function money(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: n >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: n >= 1_000_000 ? 1 : 0,
  }).format(n);
}

function initials(name: string): string {
  return name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "IN";
}

/** Deterministic, rule-based positioning advice derived from the fit factors. */
function buildAdvice(r: FounderInvestorRow): string[] {
  const factors = [
    { key: "sector", v: r.fitSector },
    { key: "stage", v: r.fitStage },
    { key: "check", v: r.fitCheck },
    { key: "geo", v: r.fitGeo },
  ].sort((a, b) => a.v - b.v);
  const weakest = factors[0];
  const tips: string[] = [];

  if (weakest.v < 100) {
    if (weakest.key === "sector" && r.sectors.length) {
      tips.push(`Sector is the weakest signal — lead your summary with your ${r.sectors[0]} angle to lift the match.`);
    } else if (weakest.key === "check") {
      tips.push(`Check-size fit is the gap. Their typical check is ${r.checkSize} — frame your ask so your round fits inside that band.`);
    } else if (weakest.key === "stage") {
      tips.push(`Stage is the gap. Make your current stage explicit${r.stages.length ? ` — they prefer ${r.stages.join(", ")}` : ""}.`);
    } else {
      tips.push("Geography is the gap. If you have a presence or plans in their region, surface it early.");
    }
  } else {
    tips.push("Strong alignment across sector, stage, check and geography — you're a natural fit; make the intro count.");
  }

  if (r.pledgeCount > 0) {
    tips.push("They've pledged on the platform before — a warm signal. Reference the traction that fits their thesis.");
  } else {
    tips.push("No activity history yet — treat as a cold, high-fit prospect. Publish a complete data room before requesting an introduction.");
  }

  if (r.scoreRated && r.investorScore != null) {
    tips.push(
      `Investor score ${r.investorScore}${r.scoreTier ? ` (${r.scoreTier})` : ""} — ${r.investorScore >= 60 ? "an active, responsive partner worth prioritizing." : "lower engagement history, so set expectations on responsiveness."}`,
    );
  }

  return tips.slice(0, 3);
}

function FitBar({ label, value }: { label: string; value: number }) {
  const cls = value >= 70 ? "bg-[var(--teal)]" : value >= 40 ? "bg-amber-500" : "bg-slate-300";
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 text-[11px] text-slate-500">{label}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded bg-slate-100">
        <span className={`block h-full rounded ${cls}`} style={{ width: `${Math.max(6, value)}%` }} />
      </span>
    </div>
  );
}

function OutreachPill({ status }: { status: OutreachStatus }) {
  const m = OUTREACH_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${m.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

const COLS = "sm:grid-cols-[1.7fr_0.7fr_1.1fr_1fr]";

function ProfileModal({ r, onClose }: { r: FounderInvestorRow; onClose: () => void }) {
  const advice = buildAdvice(r);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div className="flex items-center gap-3">
            <span className={`flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold ${SIGIL[r.band]}`}>{initials(r.name)}</span>
            <div>
              <h3 className="text-[17px] font-bold text-[var(--navy)]">{r.name}</h3>
              <p className="text-xs text-slate-500">{r.label} · Match {r.matchScore}%</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-700">✕</button>
        </div>

        <div className="px-5 pb-5">
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
            🔒 Contact details hidden — introductions run through iCapOS
          </div>

          <p className="mt-4 text-[11px] font-bold uppercase tracking-wide text-slate-400">Fit breakdown</p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <FitBar label="Sector" value={r.fitSector} />
            <FitBar label="Stage" value={r.fitStage} />
            <FitBar label="Check" value={r.fitCheck} />
            <FitBar label="Geography" value={r.fitGeo} />
          </div>

          <p className="mt-4 text-[11px] font-bold uppercase tracking-wide text-slate-400">Criteria</p>
          <dl className="mt-1 text-[13px]">
            <div className="flex justify-between border-b border-slate-100 py-2">
              <dt className="text-slate-500">Focus sectors</dt>
              <dd className="flex flex-wrap justify-end gap-1">
                {r.sectors.length ? r.sectors.map((s) => (
                  <span key={s} className="rounded-md bg-[var(--blue-muted)] px-2 py-0.5 text-[10px] font-semibold text-[var(--blue-hover)]">{s}</span>
                )) : <span className="text-slate-400">—</span>}
              </dd>
            </div>
            <div className="flex justify-between border-b border-slate-100 py-2"><dt className="text-slate-500">Preferred stages</dt><dd className="font-medium text-slate-800">{r.stages.length ? r.stages.join(", ") : "—"}</dd></div>
            <div className="flex justify-between border-b border-slate-100 py-2"><dt className="text-slate-500">Check size</dt><dd className="font-medium text-slate-800">{r.checkSize}</dd></div>
            <div className="flex justify-between border-b border-slate-100 py-2"><dt className="text-slate-500">Geography</dt><dd className="font-medium text-slate-800">{r.geographies.length ? r.geographies.join(", ") : "—"}</dd></div>
            <div className="flex justify-between border-b border-slate-100 py-2"><dt className="text-slate-500">Pledge activity</dt><dd className="font-medium text-slate-800">{r.pledgeCount > 0 ? `${r.pledgeCount} · ${money(r.indicated)} indicated` : "None yet"}</dd></div>
            <div className="flex justify-between py-2"><dt className="text-slate-500">Investor score</dt><dd className="font-medium text-slate-800">{r.scoreRated && r.investorScore != null ? `${r.investorScore}${r.scoreTier ? ` · ${r.scoreTier}` : ""}` : "Insufficient data"}</dd></div>
          </dl>

          <div className="mt-4 rounded-xl p-4" style={{ background: "#0c2340" }}>
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: "#2E78F5" }}>AI</span>
              <span className="text-[13px] font-medium" style={{ color: "#EEEDFE" }}>How to position for this investor</span>
            </div>
            {advice.map((a, i) => (
              <div key={i} className="my-1.5 flex gap-2 text-[12px] leading-relaxed" style={{ color: "#AFA9EC" }}>
                <b style={{ color: "#7F77DD" }}>{i + 1}.</b>
                <span>{a}</span>
              </div>
            ))}
          </div>

          <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2.5 text-[11px] text-slate-500">
            <b>Confidential.</b> This investor directory is private to your account — do not share or export it. Contact happens only through an iCapOS-coordinated introduction; founders don&apos;t contact investors directly.
          </p>
        </div>
      </div>
    </div>
  );
}

export function FounderPrivateMarketBoard({ rows }: Readonly<{ rows: FounderInvestorRow[] }>) {
  const t = useTranslations("founderCmp");
  const [selected, setSelected] = useState<FounderInvestorRow | null>(null);

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
        No investors to rank yet. As investors join and set preferences, your best-fit matches appear here.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--navy)] text-white">
            <LayoutGrid className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--navy)]">{t("investors")}</h2>
            <p className="font-mono text-[11px] text-slate-400">{rows.length} ranked to your company · tap for profile</p>
          </div>
        </div>
        <span className="font-mono text-[11px] text-slate-400">🔒 Confidential directory</span>
      </div>

      <div className={`hidden gap-3 border-b border-slate-200 bg-slate-50 px-5 py-2.5 font-mono text-[9.5px] uppercase tracking-wide text-slate-400 sm:grid ${COLS}`}>
        <div>{t("investor")}</div>
        <div className="text-right">{t("match")}</div>
        <div className="text-center">Outreach</div>
        <div className="text-center">Investor score</div>
      </div>

      <div>
        {rows.map((r, i) => (
          <button
            type="button"
            key={`${r.symbol}-${i}`}
            onClick={() => setSelected(r)}
            className={`grid w-full grid-cols-[1fr_auto] items-center gap-3 border-b border-slate-100 px-5 py-4 text-left transition-colors last:border-b-0 hover:bg-[var(--blue-muted)] sm:grid ${COLS}`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold ${SIGIL[r.band]}`}>
                {initials(r.name)}
              </span>
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-semibold text-[var(--navy)]">{r.name}</div>
                <div className="truncate text-[11.5px] text-slate-400">{r.label}</div>
              </div>
            </div>

            <div className="text-right">
              <div className={`font-mono text-[19px] font-semibold leading-none ${PRICE[r.band]}`}>{r.matchScore}</div>
              <div className="mt-1 font-mono text-[9px] uppercase tracking-wide text-slate-400">{BAND_LABEL[r.band]}</div>
            </div>

            <div className="flex items-center justify-start sm:justify-center">
              <OutreachPill status={r.outreach} />
            </div>

            <div className="text-left sm:text-center">
              {r.scoreRated && r.investorScore != null ? (
                <>
                  <div className="font-mono text-[17px] font-semibold leading-none text-[var(--navy)]">{r.investorScore}</div>
                  <div className="mt-1 font-mono text-[9px] uppercase tracking-wide text-slate-400">{r.scoreTier ?? "Rated"}</div>
                </>
              ) : (
                <div className="font-mono text-[10px] text-slate-400">Insufficient data</div>
              )}
            </div>
          </button>
        ))}
      </div>

      {selected ? <ProfileModal r={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}
