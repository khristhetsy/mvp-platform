"use client";

import { useState } from "react";

// Shared, anonymized investor detail panel — the fit-breakdown + criteria + AI
// positioning modal used by both the Outreach board (FounderPrivateMarketBoard)
// and the Matching Center. Takes a minimal `InvestorDetail` so any list can open
// it; identity stays hidden (introductions are brokered through iCapOS).

export type InvestorDetail = {
  name: string;
  band: string;
  matchScore: number;
  /** Investor type label, e.g. "Family Office". */
  label: string;
  fitSector: number;
  fitStage: number;
  fitCheck: number;
  fitGeo: number;
  sectors: string[];
  capitalTypes: string[];
  stages: string[];
  geographies: string[];
  checkSize: string;
  pledgeCount: number;
  indicated: number;
  investorScore: number | null;
  scoreTier: string | null;
  scoreRated: boolean;
};

const SIGIL: Record<string, string> = {
  high: "bg-[var(--teal-muted)] text-[var(--teal)]",
  mid: "bg-[var(--blue-muted)] text-[var(--blue-hover)]",
  low: "bg-slate-100 text-slate-400",
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
function buildAdvice(r: InvestorDetail): string[] {
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
    tips.push("They've indicated interest on the platform before — a warm signal. Reference the traction that fits their thesis.");
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

export function InvestorDetailModal({
  detail: r,
  onClose,
  draftEndpoint,
  introEndpoint,
  introRef,
  hideFit = false,
}: {
  detail: InvestorDetail;
  onClose: () => void;
  draftEndpoint?: string;
  introEndpoint?: string;
  introRef?: string;
  /** Hide the fit breakdown + AI positioning when there's no match data
   *  (e.g. a manually-added investor with no engine-computed fit). */
  hideFit?: boolean;
}) {
  const advice = buildAdvice(r);
  const [note, setNote] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sendState, setSendState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function sendWithNote() {
    if (!introEndpoint || !introRef) return;
    setSendState("sending");
    try {
      const res = await fetch(introEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: introRef, note }),
      });
      setSendState(res.ok ? "sent" : "error");
    } catch {
      setSendState("error");
    }
  }

  async function draft() {
    if (!draftEndpoint) return;
    setDrafting(true);
    setCopied(false);
    try {
      const res = await fetch(draftEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: r.name, investorType: r.label, sectors: r.sectors, checkSize: r.checkSize }),
      });
      const j = (await res.json().catch(() => null)) as { note?: string } | null;
      if (res.ok && j?.note) setNote(j.note);
    } finally {
      setDrafting(false);
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div className="flex items-center gap-3">
            <span className={`flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold ${SIGIL[r.band] ?? SIGIL.low}`}>{initials(r.name)}</span>
            <div>
              <h3 className="text-[17px] font-bold text-[var(--navy)]">{r.name}</h3>
              <p className="text-xs text-slate-500">{r.label} · Match {r.matchScore}%</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-700"><i className="ti ti-x" aria-hidden="true" /></button>
        </div>

        <div className="px-5 pb-5">
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
            <i className="ti ti-lock" aria-hidden="true" /> Contact details hidden — introductions run through iCapOS
          </div>

          {!hideFit && (
            <>
              <p className="mt-4 text-[11px] font-bold uppercase tracking-wide text-slate-400">Fit breakdown</p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <FitBar label="Sector" value={r.fitSector} />
                <FitBar label="Stage" value={r.fitStage} />
                <FitBar label="Check" value={r.fitCheck} />
                <FitBar label="Geography" value={r.fitGeo} />
              </div>
            </>
          )}

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
            <div className="flex justify-between border-b border-slate-100 py-2"><dt className="text-slate-500">Type of investor(s)</dt><dd className="font-medium text-slate-800">{r.label || "—"}</dd></div>
            <div className="flex justify-between border-b border-slate-100 py-2"><dt className="text-slate-500">Type(s) of capital</dt><dd className="font-medium text-slate-800">{r.capitalTypes.length ? r.capitalTypes.join(", ") : "—"}</dd></div>
            <div className="flex justify-between border-b border-slate-100 py-2"><dt className="text-slate-500">Preferred stages</dt><dd className="font-medium text-slate-800">{r.stages.length ? r.stages.join(", ") : "—"}</dd></div>
            <div className="flex justify-between border-b border-slate-100 py-2"><dt className="text-slate-500">Check size</dt><dd className="font-medium text-slate-800">{r.checkSize}</dd></div>
            <div className="flex justify-between border-b border-slate-100 py-2"><dt className="text-slate-500">Geography</dt><dd className="font-medium text-slate-800">{r.geographies.length ? r.geographies.join(", ") : "—"}</dd></div>
            <div className="flex justify-between border-b border-slate-100 py-2"><dt className="text-slate-500">Pledge activity</dt><dd className="font-medium text-slate-800">{r.pledgeCount > 0 ? `${r.pledgeCount} · ${money(r.indicated)} indicated` : "None yet"}</dd></div>
            <div className="flex justify-between py-2"><dt className="text-slate-500">Investor score</dt><dd className="font-medium text-slate-800">{r.scoreRated && r.investorScore != null ? `${r.investorScore}${r.scoreTier ? ` · ${r.scoreTier}` : ""}` : "New"}</dd></div>
          </dl>

          {!hideFit && (
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

            {draftEndpoint && (
              <div className="mt-3 border-t pt-3" style={{ borderColor: "#1e2c47" }}>
                {!note ? (
                  <button
                    type="button"
                    onClick={draft}
                    disabled={drafting}
                    className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-60"
                    style={{ background: "#2E78F5" }}
                  >
                    <i className="ti ti-sparkles" aria-hidden="true" /> {drafting ? "Drafting…" : "Draft my intro note"}
                  </button>
                ) : (
                  <>
                    <textarea
                      value={note}
                      onChange={(e) => { setNote(e.target.value); setCopied(false); }}
                      rows={5}
                      className="w-full rounded-md p-2.5 text-[11.5px] leading-relaxed outline-none"
                      style={{ background: "#0a1730", border: "0.5px solid #1e2c47", color: "#c3cede" }}
                    />
                    <div className="mt-2 flex items-center justify-end gap-2">
                      <button type="button" onClick={draft} disabled={drafting} className="rounded-md px-2.5 py-1 text-[11px]" style={{ background: "transparent", border: "0.5px solid #2b3a57", color: "#aeb8c7" }}>
                        {drafting ? "…" : "Regenerate"}
                      </button>
                      <button
                        type="button"
                        onClick={() => { void navigator.clipboard?.writeText(note); setCopied(true); }}
                        className="rounded-md px-2.5 py-1 text-[11px] font-medium text-white"
                        style={{ background: "#2E78F5" }}
                      >
                        {copied ? "Copied" : "Copy note"}
                      </button>
                      {introEndpoint && introRef && (
                        <button
                          type="button"
                          onClick={sendWithNote}
                          disabled={sendState === "sending" || sendState === "sent"}
                          className="rounded-md px-2.5 py-1 text-[11px] font-medium text-white disabled:opacity-70"
                          style={{ background: sendState === "sent" ? "#17a06a" : "#7F77DD" }}
                        >
                          {sendState === "sending" ? "Sending…" : sendState === "sent" ? "Request sent" : sendState === "error" ? "Retry" : "Send with request"}
                        </button>
                      )}
                    </div>
                    {sendState === "sent" && (
                      <p className="mt-1.5 text-right text-[10.5px]" style={{ color: "#8fe3bf" }}>
                        Your note is attached — the iCapOS team will facilitate the introduction.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
          )}

          <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2.5 text-[11px] text-slate-500">
            <b>Confidential.</b> This investor directory is private to your account — do not share or export it. Contact happens only through an iCapOS-coordinated introduction; founders don&apos;t contact investors directly.
          </p>
        </div>
      </div>
    </div>
  );
}
