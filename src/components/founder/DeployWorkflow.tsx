"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

/**
 * Deploy step-menu workflow (founder-facing).
 *
 * Hosts the four Deploy steps as a numbered menu. The Private Market board and
 * the Outreach & planning tools were relocated here — they are no longer in the
 * left sidebar, so this component is their only entry point. Server-rendered
 * content (the Private Market embed, the manual tool links, the public-profile
 * snapshot) is passed in as ReactNode props so the RSC boundary stays clean.
 *
 * Compliance note: nothing here sends on the founder's behalf or promises a
 * funding outcome. Automated outreach is an *unlock* gated on the Investable
 * Score — see the gate note in the Automated tab.
 */

type Step = "profile" | "outreach" | "analytics" | "settings";
type OutreachTab = "automated" | "manual";
type Tone = "good" | "warn" | "info";

export type DeployInsight = {
  id: string;
  title: string;
  summary: string;
  recommendations: string[];
  tone: Tone;
};

export type DeployAnalytics = {
  automated: { label: string; value: number }[];
  manual: { label: string; value: number }[];
  insights: DeployInsight[];
};

const STEPS: { key: Step; n: number; label: string }[] = [
  { key: "profile", n: 1, label: "Public Profile" },
  { key: "outreach", n: 2, label: "Outreach" },
  { key: "analytics", n: 3, label: "Analytics" },
  { key: "settings", n: 4, label: "Settings" },
];

const STEP_TIPS: Record<Step, string> = {
  profile:
    "Investors see this one-pager before anything else. A complete, published profile is what unlocks every downstream step — keep the description tight and the raise amount current.",
  outreach:
    "Automated outreach runs itself once your CRR clears the threshold. Manual outreach is for the investors you want to touch personally — use the tools to build sequences and updates.",
  analytics:
    "Compare automated vs. manual performance. Click any insight card to see what I'd change next — reply rate and follow-up debt are usually the fastest wins.",
  settings:
    "Decide when I nudge you. Auto-pause on reply keeps a sequence from talking over a live conversation, and the weekly digest rolls everything into one email.",
};

const TONE_STYLES: Record<Tone, { ring: string; dot: string; chip: string }> = {
  good: { ring: "border-emerald-200", dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700" },
  warn: { ring: "border-amber-200", dot: "bg-amber-500", chip: "bg-amber-50 text-amber-700" },
  info: { ring: "border-indigo-200", dot: "bg-indigo-500", chip: "bg-indigo-50 text-indigo-700" },
};

function MiniBars({ title, data, accent }: { title: string; data: { label: string; value: number }[]; accent: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="mb-3 text-sm font-medium text-slate-900">{title}</p>
      <div className="space-y-2.5">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-xs text-slate-500">{d.label}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.round((d.value / max) * 100)}%`, background: accent }}
              />
            </div>
            <span className="w-8 shrink-0 text-right text-xs font-semibold text-slate-700">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InsightCard({ insight }: { insight: DeployInsight }) {
  const [open, setOpen] = useState(false);
  const tone = TONE_STYLES[insight.tone];
  return (
    <div className={`rounded-xl border bg-white ${tone.ring}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${tone.dot}`} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-slate-900">{insight.title}</span>
          <span className="block truncate text-xs text-slate-500">{insight.summary}</span>
        </span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone.chip}`}>
          {open ? "Hide" : "AI fix"}
        </span>
      </button>
      {open ? (
        <div className="border-t border-slate-100 px-4 py-3">
          <p className="mb-2 text-xs text-slate-600">{insight.summary}</p>
          <ul className="space-y-1.5">
            {insight.recommendations.map((rec) => (
              <li key={rec} className="flex gap-2 text-xs text-slate-700">
                <span className="mt-0.5 text-indigo-500" aria-hidden="true">→</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

const TOGGLE_GROUPS: { group: string; items: { key: string; label: string; hint?: string; on: boolean }[] }[] = [
  {
    group: "Email activity",
    items: [
      { key: "sent", label: "When an email is sent", on: true },
      { key: "opened", label: "When an email is opened", on: true },
      { key: "reviewed", label: "When your profile is reviewed", on: true },
      { key: "responded", label: "When an investor responds", on: true },
    ],
  },
  {
    group: "Reminders & automation",
    items: [
      { key: "followup", label: "Follow-up reminders", hint: "Nudge me when a thread goes quiet", on: true },
      { key: "autopause", label: "Auto-pause a sequence on reply", hint: "Stop automated sends once someone replies", on: true },
      { key: "digest", label: "Weekly digest", hint: "One roll-up email every Monday", on: false },
    ],
  },
];

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      style={{
        position: "relative",
        height: 22,
        width: 40,
        flexShrink: 0,
        padding: 0,
        border: "none",
        borderRadius: 9999,
        cursor: "pointer",
        transition: "background-color 150ms",
        backgroundColor: on ? "#4f46e5" : "#cbd5e1",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: 2,
          height: 18,
          width: 18,
          borderRadius: 9999,
          backgroundColor: "#ffffff",
          boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
          transition: "transform 150ms",
          transform: on ? "translateX(18px)" : "translateX(0)",
        }}
      />
    </button>
  );
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

function SettingsPanel() {
  const [state, setState] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const g of TOGGLE_GROUPS) for (const i of g.items) initial[i.key] = i.on;
    return initial;
  });
  const [doNotContact, setDoNotContact] = useState("");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [dirty, setDirty] = useState(false);

  // Load the founder's saved preferences (falls back to the defaults above).
  useEffect(() => {
    let active = true;
    fetch("/api/founder/deploy-preferences")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!active || !d?.prefs) return;
        const n = d.prefs.notifications as Record<string, boolean> | undefined;
        if (n) setState((s) => ({ ...s, ...n }));
        if (Array.isArray(d.prefs.doNotContact)) setDoNotContact((d.prefs.doNotContact as string[]).join("\n"));
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const save = useCallback(async () => {
    setStatus("saving");
    try {
      const res = await fetch("/api/founder/deploy-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notifications: state,
          doNotContact: doNotContact.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean),
        }),
      });
      if (!res.ok) throw new Error("save failed");
      setStatus("saved");
      setDirty(false);
    } catch {
      setStatus("error");
    }
  }, [state, doNotContact]);

  const toggle = (key: string) => { setState((s) => ({ ...s, [key]: !s[key] })); setDirty(true); setStatus("idle"); };

  return (
    <div className="space-y-5">
      {TOGGLE_GROUPS.map((g) => (
        <div key={g.group} className="rounded-xl border border-slate-200 bg-white px-4 py-1">
          <p className="pt-3 pb-1.5 text-sm font-medium text-slate-900">{g.group}</p>
          <div>
            {g.items.map((i) => (
              <div
                key={i.key}
                className="flex items-center justify-between gap-4 border-t border-slate-100 py-3 first:border-t-0"
              >
                <div className="min-w-0">
                  <p className="text-sm text-slate-700">{i.label}</p>
                  {i.hint ? <p className="mt-0.5 text-xs text-slate-400">{i.hint}</p> : null}
                </div>
                <Toggle
                  on={state[i.key]}
                  label={i.label}
                  onClick={() => toggle(i.key)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-medium text-slate-900">Sender identity &amp; do-not-contact</p>
        <p className="mt-0.5 text-xs text-slate-400">
          Domains or emails here are suppressed from every automated and manual send. One per line.
        </p>
        <textarea
          value={doNotContact}
          onChange={(e) => { setDoNotContact(e.target.value); setDirty(true); setStatus("idle"); }}
          rows={3}
          placeholder="competitor.com&#10;someone@example.com"
          className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400"
        />
      </div>

      <div className="sticky bottom-0 flex items-center gap-3 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <p className="text-xs text-slate-400">
          Preferences control how iCapOS notifies you. Do-not-contact entries are suppressed across every send.
        </p>
        <div className="ml-auto flex items-center gap-3">
          {status === "saved" && !dirty ? (
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-600"><span aria-hidden><i className="ti ti-check" aria-hidden="true" /></span> Saved</span>
          ) : status === "error" ? (
            <span className="text-xs font-medium text-red-600">Couldn&apos;t save — retry</span>
          ) : dirty ? (
            <span className="text-xs text-slate-400">Unsaved changes</span>
          ) : null}
          <button
            type="button"
            onClick={save}
            disabled={status === "saving" || (!dirty && status !== "error")}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
          >
            {status === "saving" ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function DeployWorkflow({
  companyName,
  investableScore,
  outreachThreshold,
  publicProfile,
  automated,
  manual,
  analytics,
}: {
  companyName: string;
  investableScore: number;
  outreachThreshold: number;
  publicProfile: ReactNode;
  automated: ReactNode;
  manual: ReactNode;
  analytics: DeployAnalytics;
}) {
  const [step, setStep] = useState<Step>("profile");
  const [otab, setOtab] = useState<OutreachTab>("automated");
  const [aiOpen, setAiOpen] = useState(false);

  const scoreReady = investableScore >= outreachThreshold;

  return (
    <div className="pb-24">
      {/* Step menu */}
      <div className="sticky top-0 z-10 -mx-2 mb-6 border-b border-slate-200 bg-white/90 px-2 backdrop-blur">
        <nav className="flex gap-1 overflow-x-auto">
          {STEPS.map((s) => {
            const active = s.key === step;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setStep(s.key)}
                className={`relative flex items-center gap-2 whitespace-nowrap px-3.5 py-3 text-sm font-semibold transition ${
                  active ? "text-indigo-600" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                    active ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {s.n}
                </span>
                {s.label}
                {active ? <span className="absolute inset-x-2 -bottom-px h-0.5 rounded bg-indigo-600" /> : null}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ---------- STEP 1 · PUBLIC PROFILE ---------- */}
      {step === "profile" ? <div className="space-y-4">{publicProfile}</div> : null}

      {/* ---------- STEP 2 · OUTREACH ---------- */}
      {step === "outreach" ? (
        <div className="space-y-5">
          <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
            {(["automated", "manual"] as OutreachTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setOtab(tab)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition ${
                  otab === tab ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {otab === "automated" ? (
            <div className="space-y-4">
              <div
                className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-xs leading-relaxed ${
                  scoreReady
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : "border-amber-200 bg-amber-50 text-amber-900"
                }`}
              >
                <span aria-hidden="true">{scoreReady ? <i className="ti ti-check" aria-hidden="true" /> : "ⓘ"}</span>
                <span>
                  {scoreReady ? (
                    <>
                      <b>Automated outreach is on.</b> Your CRR is {investableScore} (threshold{" "}
                      {outreachThreshold}), so your Founder Preview one-pager is shared automatically with matched
                      investors in your industry (50+ match) — a limited batch per week, skipping anyone who has
                      unsubscribed, and never the same investor twice. Nothing to configure here. If your score drops
                      below {outreachThreshold}, it pauses on its own.
                    </>
                  ) : (
                    <>
                      <b>Automated outreach is paused.</b> It turns on at a CRR of {outreachThreshold}; you
                      are at {investableScore}. Raise your score in Qualify to switch it on — once you clear the
                      threshold, your Founder Preview is shared with matched investors automatically.
                    </>
                  )}
                </span>
              </div>
              {automated}
            </div>
          ) : (
            <div className="space-y-4">{manual}</div>
          )}
        </div>
      ) : null}

      {/* ---------- STEP 3 · ANALYTICS ---------- */}
      {step === "analytics" ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <MiniBars title="Automated outreach" data={analytics.automated} accent="#6366f1" />
            <MiniBars title="Manual outreach" data={analytics.manual} accent="#0ea5e9" />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-slate-900">AI insights</p>
            <div className="space-y-2">
              {analytics.insights.map((insight) => (
                <InsightCard key={insight.id} insight={insight} />
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* ---------- STEP 4 · SETTINGS ---------- */}
      {step === "settings" ? <SettingsPanel /> : null}

      {/* ---------- AI ASSISTANT (docked) ---------- */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-2.5">
          <button
            type="button"
            onClick={() => setAiOpen((v) => !v)}
            className="flex w-full items-center gap-2.5 text-left"
            aria-expanded={aiOpen}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
              AI
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-slate-600">
              {aiOpen ? `Assistant · ${companyName}` : STEP_TIPS[step]}
            </span>
            <span className="shrink-0 text-xs text-slate-400">{aiOpen ? "Hide" : "Tip"}</span>
          </button>
          {aiOpen ? <p className="mt-2 pl-9 text-sm leading-relaxed text-slate-600">{STEP_TIPS[step]}</p> : null}
        </div>
      </div>
    </div>
  );
}
