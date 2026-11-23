"use client";

import { useState } from "react";
import { DoneCard, WizardFrame } from "@/components/founder/social/LaunchFrame";
import { api, btn, btnPrimary, type Campaign } from "@/components/founder/social/FounderSocialShared";

const LABELS = ["Name", "Goals", "Alerts", "Review"];
const IDEAS = ["Raise a round", "Hire a role", "Announce a milestone"];
const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const num = (v: string): number | null => { const n = Number(v.replace(/[^0-9]/g, "")); return v.trim() === "" || !Number.isFinite(n) ? null : n; };

/** Part 2 of Launch my social media: a campaign, its monthly goals, and two optional alerts. */
export function CampaignWizard({ onChanged, onExit, onNext }: { onChanged: () => Promise<void>; onExit: () => void; onNext: (campaign: Campaign | null) => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [posts, setPosts] = useState("");
  const [clicks, setClicks] = useState("");
  const [meetings, setMeetings] = useState("");
  const [alertMeetings, setAlertMeetings] = useState(true);
  const [alertClicks, setAlertClicks] = useState(false);
  const [emailToo, setEmailToo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [created, setCreated] = useState<Campaign | null>(null);
  const [finished, setFinished] = useState(false);

  async function create() {
    setErr(null); setBusy(true);
    let campaign = created;
    if (!campaign) {
      const r = await api<{ campaign: Campaign }>("/api/founder/social/campaigns", json("POST", { name: name.trim() }));
      if (!r.ok) { setBusy(false); setErr(r.data.error ?? "Could not create the campaign."); return; }
      campaign = r.data.campaign;
      setCreated(campaign);
    }
    const goals = { outreach: num(posts), clicks: num(clicks), meetings: num(meetings) };
    if (Object.values(goals).some((v) => v !== null)) {
      const g = await api("/api/founder/social/goals", json("POST", { campaignId: campaign.id, grain: "month", goals }));
      if (!g.ok) { setBusy(false); setErr(`The campaign was created, but the goals did not save. ${g.data.error ?? ""}`.trim()); return; }
    }
    const rules: { metric: string }[] = [];
    if (alertMeetings && goals.meetings !== null) rules.push({ metric: "meetings" });
    if (alertClicks && goals.clicks !== null) rules.push({ metric: "clicks" });
    for (const rule of rules) {
      const a = await api("/api/founder/social/alerts", json("POST", { metric: rule.metric, direction: "behind_pace", threshold_pct: 75, grain: "month", channel: emailToo ? "both" : "in_app", campaign_id: campaign.id }));
      if (!a.ok) { setBusy(false); setErr(`The campaign was created, but an alert did not save. ${a.data.error ?? ""}`.trim()); return; }
    }
    await onChanged();
    setBusy(false);
    setFinished(true);
  }

  if (finished) {
    return (
      <DoneCard title="Campaign created" body="Next, write a post for it.">
        <button type="button" className={btnPrimary} onClick={() => onNext(created)}>Write a post</button>
        <button type="button" className={btn} onClick={onExit}>Back to home</button>
      </DoneCard>
    );
  }

  const goalsSet = [posts, clicks, meetings].some((v) => v.trim() !== "");
  const input = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900";
  return (
    <WizardFrame title="Create a campaign" part="Launch my social media, part 2 of 4" labels={LABELS} step={step}
      onBack={() => { setErr(null); setStep((s) => Math.max(0, s - 1)); }}
      onNext={() => (step === 3 ? void create() : setStep((s) => s + 1))}
      nextLabel={step === 3 ? (created ? "Finish saving" : "Create campaign") : "Next"} nextDisabled={step === 0 && !name.trim()} busy={busy} onExit={onExit}>
      {step === 0 && (
        <div>
          <h3 className="text-base font-semibold text-slate-900">What is this campaign for?</h3>
          <p className="mt-1 text-sm text-slate-600">A campaign groups related posts so their results roll up in one place.</p>
          <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Ideas">
            {IDEAS.map((i) => (
              <button key={i} type="button" aria-pressed={name === i} onClick={() => setName(i)} className={`rounded-full border px-3 py-1 text-sm ${name === i ? "border-[#1A6CE4] bg-blue-50 text-[#1A6CE4]" : "border-slate-300 text-slate-600"}`}>{i}</button>
            ))}
          </div>
          <label className="mt-3 block text-xs text-slate-500">Campaign name
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Seed round outreach" className={input} />
          </label>
        </div>
      )}
      {step === 1 && (
        <div>
          <h3 className="text-base font-semibold text-slate-900">Set your monthly goals</h3>
          <p className="mt-1 text-sm text-slate-600">Optional. Start small. You can change these any time.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="text-xs text-slate-500">Posts published<input inputMode="numeric" value={posts} onChange={(e) => setPosts(e.target.value.replace(/[^0-9]/g, ""))} className={input} /></label>
            <label className="text-xs text-slate-500">Clicks<input inputMode="numeric" value={clicks} onChange={(e) => setClicks(e.target.value.replace(/[^0-9]/g, ""))} className={input} /></label>
            <label className="text-xs text-slate-500">Meetings<input inputMode="numeric" value={meetings} onChange={(e) => setMeetings(e.target.value.replace(/[^0-9]/g, ""))} className={input} /></label>
          </div>
        </div>
      )}
      {step === 2 && (
        <div>
          <h3 className="text-base font-semibold text-slate-900">Tell me if you fall behind</h3>
          <p className="mt-1 text-sm text-slate-600">Optional. An alert needs a goal for that number. It fires when you are below 75% of pace for the month.</p>
          <div className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
            {[
              { label: "Meetings fall behind pace", on: alertMeetings, set: setAlertMeetings, ok: num(meetings) !== null },
              { label: "Clicks fall behind pace", on: alertClicks, set: setAlertClicks, ok: num(clicks) !== null },
              { label: "Email me as well as in app", on: emailToo, set: setEmailToo, ok: true },
            ].map((r) => (
              <label key={r.label} className={`flex items-center justify-between gap-3 px-3 py-2 text-sm ${r.ok ? "text-slate-900" : "text-slate-400"}`}>
                <span>{r.label}{!r.ok && <span className="ml-2 text-xs">Set a goal first</span>}</span>
                <input type="checkbox" checked={r.on && r.ok} disabled={!r.ok} onChange={(e) => r.set(e.target.checked)} />
              </label>
            ))}
          </div>
        </div>
      )}
      {step === 3 && (
        <div>
          <h3 className="text-base font-semibold text-slate-900">Review and create</h3>
          <dl className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
            <div className="flex justify-between gap-3 px-3 py-2"><dt className="text-slate-500">Campaign</dt><dd className="text-slate-900">{name.trim()}</dd></div>
            <div className="flex justify-between gap-3 px-3 py-2"><dt className="text-slate-500">Goals per month</dt><dd className="text-right text-slate-900">{goalsSet ? [posts && `${posts} posts`, clicks && `${clicks} clicks`, meetings && `${meetings} meetings`].filter(Boolean).join(", ") : "None set"}</dd></div>
            <div className="flex justify-between gap-3 px-3 py-2"><dt className="text-slate-500">Alerts</dt><dd className="text-slate-900">{[alertMeetings && num(meetings) !== null && "Meetings", alertClicks && num(clicks) !== null && "Clicks"].filter(Boolean).join(", ") || "None"}{emailToo ? ", by email too" : ""}</dd></div>
          </dl>
          {err && <p className="mt-3 text-sm text-red-700" role="alert">{err}</p>}
        </div>
      )}
    </WizardFrame>
  );
}
