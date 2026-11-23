"use client";

import { useState } from "react";
import { WizardFrame } from "@/components/founder/social/LaunchFrame";
import { btn, btnPrimary, sumStage, type Campaign } from "@/components/founder/social/FounderSocialShared";
import { STAGES, STAGE_LABELS, fmt, type CampaignFunnel, type StageKey } from "@/components/admin/social/funnel-types";
import { stepRatioPct, weakestStage } from "@/lib/social/launch";

const LABELS = ["Funnel", "Weakest step", "What worked", "Next post"];
export const REVIEWED_KEY = "icapos_founder_social_reviewed";

/** Part 4 of Launch my social media: a short weekly look at the funnel. Numbers come from the same funnel data as before. */
export function ReviewWizard({ funnels, campaigns, intros, introsOther, introsByTag, onExit, onWrite }: {
  funnels: CampaignFunnel[]; campaigns: Campaign[]; intros: number; introsOther: number; introsByTag: Record<string, number>; onExit: () => void; onWrite: () => void;
}) {
  const [step, setStep] = useState(0);
  const totals = STAGES.map((k) => ({ key: k, ...sumStage(funnels, k) }));
  const weakest = weakestStage(totals.map((t) => ({ stage: t.key, actual: t.actual, target: t.target })));
  const get = (f: CampaignFunnel, k: StageKey) => f.stages.find((s) => s.stage === k)?.actual ?? 0;
  const ranked = [...funnels].sort((a, b) => get(b, "meetings") - get(a, "meetings") || get(b, "clicks") - get(a, "clicks"));
  const best = ranked[0];
  const hasData = funnels.length > 0 && totals.some((t) => t.actual > 0);

  function finish() {
    try { localStorage.setItem(REVIEWED_KEY, new Date().toISOString()); } catch { /* storage unavailable */ }
    onWrite();
  }

  return (
    <WizardFrame title="Weekly review" part="Launch my social media, part 4 of 4" labels={LABELS} step={step}
      onBack={() => setStep((s) => Math.max(0, s - 1))} onNext={() => (step === 3 ? finish() : setStep((s) => s + 1))}
      nextLabel={step === 3 ? "Write the next post" : "Next"} onExit={onExit}
      extraFooter={step === 3 ? <button type="button" className={btn} onClick={() => { try { localStorage.setItem(REVIEWED_KEY, new Date().toISOString()); } catch { /* storage unavailable */ } onExit(); }}>Finish review</button> : null}>
      {step === 0 && (
        <div>
          <h3 className="text-base font-semibold text-slate-900">Your funnel this month</h3>
          {!hasData ? <p className="mt-2 text-sm text-slate-600">No results yet. Publish a post in a campaign and the numbers appear here.</p> : (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {totals.map((t, i) => {
                const prev = i > 0 ? totals[i - 1].actual : 0;
                const ratio = i > 0 ? stepRatioPct(prev, t.actual) : null;
                return (
                  <div key={t.key} className="rounded-lg border border-slate-200 px-3 py-3 text-center">
                    <div className="text-2xl font-semibold text-slate-900">{fmt(t.actual)}</div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">{STAGE_LABELS[t.key]}</div>
                    <div className="mt-1 text-xs text-slate-500">{t.target ? `Goal ${fmt(t.target)}` : "No goal set"}</div>
                    {ratio !== null && <div className="mt-1 text-[11px] text-slate-400">{ratio}% of {STAGE_LABELS[totals[i - 1].key].toLowerCase()}</div>}
                  </div>
                );
              })}
            </div>
          )}
          <p className="mt-3 text-xs text-slate-500">Investor intros: {intros + introsOther} in total, {intros} from a tracked post link.</p>
        </div>
      )}
      {step === 1 && (
        <div>
          <h3 className="text-base font-semibold text-slate-900">Your weakest step</h3>
          {weakest ? (
            <p className="mt-2 text-sm text-slate-700"><strong>{STAGE_LABELS[weakest.stage as StageKey]}</strong> is furthest from its goal: {fmt(weakest.actual)} of {fmt(weakest.target)}, which is {weakest.pct}%. Focus your next post here.</p>
          ) : (
            <p className="mt-2 text-sm text-slate-600">No goals are set, so there is no weakest step to name. Set goals when you create a campaign.</p>
          )}
        </div>
      )}
      {step === 2 && (
        <div>
          <h3 className="text-base font-semibold text-slate-900">What worked</h3>
          {!best || !hasData ? <p className="mt-2 text-sm text-slate-600">Nothing to compare yet.</p> : (
            <>
              <p className="mt-2 text-sm text-slate-700"><strong>{best.name}</strong> leads this month with {get(best, "clicks")} clicks and {get(best, "meetings")} meetings.</p>
              {ranked.length > 1 && (
                <table className="mt-3 w-full text-sm">
                  <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-400"><th className="py-2 font-medium">Campaign</th><th className="py-2 font-medium">Clicks</th><th className="py-2 font-medium">Meetings</th><th className="py-2 font-medium">Intros</th></tr></thead>
                  <tbody>{ranked.map((f) => (
                    <tr key={f.campaignId} className="border-t border-slate-100"><td className="py-2 text-slate-900">{f.name}</td><td className="py-2">{get(f, "clicks")}</td><td className="py-2">{get(f, "meetings")}</td><td className="py-2">{introsByTag[f.sourceTag] ?? 0}</td></tr>
                  ))}</tbody>
                </table>
              )}
            </>
          )}
        </div>
      )}
      {step === 3 && (
        <div>
          <h3 className="text-base font-semibold text-slate-900">Write the next post</h3>
          <p className="mt-2 text-sm text-slate-700">
            {weakest ? `Aim it at ${STAGE_LABELS[weakest.stage as StageKey].toLowerCase()}, your weakest step.` : "Pick any topic and keep it short."}
            {campaigns.length === 0 ? " Create a campaign first so the post counts toward a goal." : ""}
          </p>
          <button type="button" className={`${btnPrimary} mt-3`} onClick={finish}>Write the next post</button>
        </div>
      )}
    </WizardFrame>
  );
}
