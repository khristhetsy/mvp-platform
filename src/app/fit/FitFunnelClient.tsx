"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Q1_STAGE, Q2_RAISE, Q4_REVENUE, Q5_INVESTOR_TYPE, type FitAnswers } from "@/lib/fit/options";

type MatchResult = {
  contactId: string; company: string; summary: string; fit: number;
  sectors: string[]; types: string[]; stage: string | null; checkSize: string | null; revenue: string | null;
  score: number | null; tier: string | null;
};
type MatchResponse = { matched_count: number; top: MatchResult[]; locked_count: number; thin: boolean; network_total: number };

// Tier → ring/badge colors (matches the investor-rating scale).
function tierColor(tier: string | null): { ring: string; bg: string; fg: string } {
  const t = (tier ?? "").toLowerCase();
  if (t.startsWith("a") || t === "excellent") return { ring: "#1D9E75", bg: "#E1F5EE", fg: "#0F6E56" };
  if (t.startsWith("b") || t === "strong" || t === "good") return { ring: "#BA7517", bg: "#FAEEDA", fg: "#854F0B" };
  if (!tier || t === "new") return { ring: "#B4B2A9", bg: "#F1EFE8", fg: "#5F5E5A" };
  return { ring: "#378ADD", bg: "#E6F1FB", fg: "#185FA5" };
}

function MatchCard({ m }: { m: MatchResult }) {
  const [open, setOpen] = useState(false);
  const c = tierColor(m.tier);
  const summaryLine = [m.sectors[0], m.stage, m.checkSize].filter(Boolean).join(" · ");
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 p-3 text-left">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-slate-900">{m.company}</p>
          {summaryLine ? <p className="mt-0.5 truncate text-[11px] text-slate-500">{summaryLine}</p> : null}
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-[11px] font-semibold text-emerald-600">{m.fit}% fit</span>
            <span className="h-1 w-16 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-emerald-500" style={{ width: `${m.fit}%` }} /></span>
          </div>
        </div>
        <div className="flex w-[70px] flex-shrink-0 flex-col items-center gap-1">
          <span className="text-[8.5px] font-medium uppercase tracking-wide text-slate-400">Investor score</span>
          <span className="flex h-11 w-11 items-center justify-center rounded-full text-[15px] font-semibold text-slate-900" style={{ border: `3px solid ${c.ring}` }}>{m.score ?? "—"}</span>
          <span className="rounded px-1.5 py-px text-[9px] font-medium" style={{ background: c.bg, color: c.fg }}>{m.tier ?? "New"}</span>
        </div>
        <i className={`ti ti-chevron-${open ? "down" : "right"} flex-shrink-0 text-slate-400`} aria-hidden="true" />
      </button>
      {open ? (
        <div className="border-t border-slate-100 bg-slate-50 px-3 py-3 text-[12px]">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <div><p className="text-slate-400">Sectors</p><p className="text-slate-700">{m.sectors.slice(0, 4).join(", ") || "—"}</p></div>
            <div><p className="text-slate-400">Stage</p><p className="text-slate-700">{m.stage ?? "—"}</p></div>
            <div><p className="text-slate-400">Check size</p><p className="text-slate-700">{m.checkSize ?? "—"}</p></div>
            <div><p className="text-slate-400">Revenue focus</p><p className="text-slate-700">{m.revenue ?? "—"}</p></div>
            <div className="col-span-2"><p className="text-slate-400">Investor type</p><p className="text-slate-700">{m.types.slice(0, 4).join(", ") || "—"}</p></div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const RAISE_LABEL: Record<string, string> = Object.fromEntries(Q2_RAISE.map((o) => [o.key, o.label]));
const STAGE_LABEL: Record<string, string> = Object.fromEntries(Q1_STAGE.map((o) => [o.key, o.label]));
const REV_LABEL: Record<string, string> = Object.fromEntries(Q4_REVENUE.map((o) => [o.key, o.label]));

function FunnelHeader() {
  return (
    <div className="mb-6 flex flex-col items-center text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icapos-logo.svg" alt="iCapOS" className="h-8 w-auto" />
      <p className="mt-3 text-[13.5px] leading-relaxed text-slate-500">
        Answer five quick questions and instantly see the investors in our network that match your raise.
      </p>
    </div>
  );
}

const TOTAL_STEPS = 5;

/** A multi-select funnel question: toggle options, then Continue (≥1 required). */
function MultiQ({ n, title, options, selected, onToggle, onContinue, loading }: {
  n: number; title: string;
  options: { key: string; label: string }[];
  selected: string[]; onToggle: (key: string) => void; onContinue: () => void; loading?: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <FunnelHeader />
      <p className="font-mono text-xs uppercase tracking-wider text-indigo-500">Question {n} of {TOTAL_STEPS}</p>
      <h1 className="mt-2 text-[22px] font-semibold leading-snug text-slate-900">{title}</h1>
      <p className="mt-1 text-[13px] text-slate-500">Select all that apply.</p>
      <div className="mt-4 flex flex-col gap-2.5">
        {loading ? <p className="text-sm text-slate-400">Loading…</p> : options.map((o) => {
          const on = selected.includes(o.key);
          return (
            <button key={o.key} type="button" onClick={() => onToggle(o.key)}
              className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-[15px] transition-colors ${on ? "border-indigo-500 bg-indigo-50 font-medium text-indigo-700" : "border-slate-200 bg-white text-slate-800 hover:border-indigo-300"}`}>
              <span className={`flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded ${on ? "bg-indigo-600 text-white" : "border-[1.5px] border-slate-300"}`}>{on ? <i className="ti ti-check text-[11px]" aria-hidden="true" /> : null}</span>
              {o.label}
            </button>
          );
        })}
      </div>
      <button type="button" disabled={selected.length === 0} onClick={onContinue}
        className="mt-5 w-full rounded-lg bg-indigo-600 px-5 py-3.5 text-sm font-semibold text-white transition-opacity hover:bg-indigo-700 disabled:opacity-40">
        Continue{selected.length ? ` · ${selected.length} selected` : ""}
      </button>
    </div>
  );
}

const EMPTY: FitAnswers = { stage: [], raise: [], industry: [], revenue: [], investorType: [] };

export function FitFunnelClient() {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | "match" | "method">(1);
  const [answers, setAnswers] = useState<FitAnswers>(EMPTY);
  const [sectors, setSectors] = useState<string[]>([]);
  const [result, setResult] = useState<MatchResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [captured, setCaptured] = useState(false);

  useEffect(() => {
    fetch("/api/fit/sectors").then((r) => (r.ok ? r.json() : null)).then((d) => setSectors(d?.sectors ?? [])).catch(() => {});
    const tag = new URLSearchParams(window.location.search).get("s");
    fetch("/api/fit/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceTag: tag }) }).catch(() => {});
  }, []);

  const empty: MatchResponse = { matched_count: 0, top: [], locked_count: 0, thin: true, network_total: 0 };

  async function runMatch(final: FitAnswers) {
    setBusy(true);
    setStep("match");
    try {
      const res = await fetch("/api/fit/match", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(final) });
      setResult(res.ok ? await res.json() : empty);
    } catch {
      setResult(empty);
    } finally {
      setBusy(false);
    }
  }

  const toggle = (field: keyof FitAnswers, value: string) =>
    setAnswers((a) => ({ ...a, [field]: a[field].includes(value) ? a[field].filter((v) => v !== value) : [...a[field], value] }));

  function advance(field: keyof FitAnswers, stepNum: number, next: 2 | 3 | 4 | 5 | "done") {
    // Record last_step (drop-off diagnostic) + the answer as a joined string. The session
    // has no investor_type column, so that step logs step only.
    const body: Record<string, unknown> = { step: stepNum };
    if (field !== "investorType") body[field] = answers[field].join(", ");
    fetch("/api/fit/session", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => {});
    if (next === "done") void runMatch(answers);
    else setStep(next);
  }

  if (step === 1) return <MultiQ n={1} title="Where are you today?" options={Q1_STAGE} selected={answers.stage} onToggle={(k) => toggle("stage", k)} onContinue={() => advance("stage", 1, 2)} />;
  if (step === 2) return <MultiQ n={2} title="How much are you raising?" options={Q2_RAISE} selected={answers.raise} onToggle={(k) => toggle("raise", k)} onContinue={() => advance("raise", 2, 3)} />;
  if (step === 3) return <MultiQ n={3} title="What sectors are you in?" options={sectors.map((s) => ({ key: s, label: s }))} loading={sectors.length === 0} selected={answers.industry} onToggle={(k) => toggle("industry", k)} onContinue={() => advance("industry", 3, 4)} />;
  if (step === 4) return <MultiQ n={4} title="What is your revenue?" options={Q4_REVENUE} selected={answers.revenue} onToggle={(k) => toggle("revenue", k)} onContinue={() => advance("revenue", 4, 5)} />;
  if (step === 5) return <MultiQ n={5} title="What type of investor are you looking for?" options={Q5_INVESTOR_TYPE} selected={answers.investorType} onToggle={(k) => toggle("investorType", k)} onContinue={() => advance("investorType", 5, "done")} />;

  // Match screen
  const a = answers;
  const j = (arr: string[], map?: Record<string, string>) => arr.map((k) => (map ? map[k] ?? k : k)).join(", ");
  const subline = `${j(a.industry)} · raising ${j(a.raise, RAISE_LABEL)} · ${j(a.revenue, REV_LABEL)} revenue · ${j(a.stage, STAGE_LABEL)}`;
  const count = result?.matched_count ?? 0;
  const thin = result?.thin ?? true;

  // /fit/method — iCFO Capital advisory SPV screen (build-spec §6). Gold badge, a
  // dot diagram sized to the actual match count, four steps, a scoped panel (no
  // figures), the verbatim disclaimer, and one CTA to the structuring-call scheduler
  // (which links back to this funnel session via the fs_session cookie).
  if (step === "method") {
    return (
      <div className="mx-auto w-full max-w-md">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-amber-700">
          <i className="ti ti-building-bank" aria-hidden="true" /> iCFO Capital · Advisory
        </span>
        <h1 className="mt-3 text-[22px] font-semibold leading-snug text-slate-900">Run your raise through an SPV</h1>
        <p className="mt-1.5 text-[13px] text-slate-500">One vehicle. One cap-table line. One close — scoped to your raise.</p>

        <div className="relative mt-6 pl-7">
          <span className="absolute bottom-1.5 left-[11px] top-1.5 w-0.5 bg-gradient-to-b from-indigo-600 to-indigo-200" aria-hidden="true" />
          {[
            { t: "Form the vehicle", d: "We structure the SPV. Due diligence runs in parallel." },
            { t: "Reach matched investors", d: "The opportunity goes to investors whose stage, sector, and check size fit." },
            { t: "Investors subscribe", d: "Participation flows directly into the SPV as limited partners." },
            { t: "Funded", d: "Capital deploys on a rolling basis — first in, first out.", done: true },
          ].map((s, i) => (
            <div key={s.t} className={`relative ${i < 3 ? "mb-5" : ""}`}>
              <span className={`absolute -left-7 top-0 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold text-white ${s.done ? "bg-emerald-600" : "bg-indigo-600"}`}>
                {s.done ? <i className="ti ti-check" aria-hidden="true" /> : i + 1}
              </span>
              <p className="text-[14px] font-medium text-slate-900">{s.t}</p>
              <p className="mt-0.5 text-[12px] text-slate-500">{s.d}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-[13px] font-medium text-slate-700">Scoped to your raise</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-slate-500">{subline}. We structure the vehicle and manage outreach against your matched mandates.</p>
        </div>

        <Link href="/schedule/dc2f3667-ca80-4f35-a1cd-ba0c3adac510" className="mt-6 block rounded-lg bg-indigo-600 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-indigo-700">Book a structuring call</Link>

        <p className="mt-6 border-t border-slate-100 pt-4 text-[11px] leading-5 text-slate-400">
          iCFO Capital Global, Inc. is not a registered broker-dealer, funding portal, investment adviser, or placement agent. It does not offer or sell securities, effect securities transactions, hold or transmit customer funds, or receive transaction-based compensation.
        </p>
      </div>
    );
  }

  const networkTotal = result?.network_total ?? 0;
  const hasMatches = count > 0 && !thin;

  return (
    <div className="mx-auto w-full max-w-md">
      {busy ? (
        <p className="text-center text-sm text-slate-400">Matching against our network…</p>
      ) : hasMatches ? (
        <>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="text-[19px] font-semibold leading-snug text-slate-900">{count} investors match your raise</h1>
              <p className="mt-1 text-[12px] text-slate-500">{subline}</p>
            </div>
            <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-medium text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/25" /> Live data
            </span>
          </div>

          <div className="mt-3 flex gap-2">
            <div className="flex-1 rounded-lg bg-slate-50 px-3 py-2"><p className="text-[10.5px] text-slate-400">In our network</p><p className="text-[18px] font-semibold text-slate-900">{networkTotal.toLocaleString()}</p></div>
            <div className="flex-1 rounded-lg bg-slate-50 px-3 py-2"><p className="text-[10.5px] text-slate-400">Match you</p><p className="text-[18px] font-semibold text-emerald-600">{count}</p></div>
          </div>

          <div className="mt-3 flex flex-col gap-2.5">
            {result!.top.map((m) => <MatchCard key={m.contactId} m={m} />)}
            {result!.locked_count > 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-center text-[12.5px] font-medium text-indigo-600">
                <i className="ti ti-lock" aria-hidden="true" /> Unlock more matched
              </div>
            ) : null}
          </div>

          <button onClick={() => setStep("method")} className="mt-4 w-full rounded-lg bg-indigo-600 px-5 py-3.5 text-sm font-semibold text-white hover:bg-indigo-700">See how we structure your raise</button>
        </>
      ) : (
        <>
          <h1 className="text-[22px] font-semibold leading-snug text-slate-900">No investors in our network match this profile yet</h1>
          <p className="mt-1.5 text-[13px] text-slate-500">{subline}. Leave your email and we&apos;ll tell you when one does.</p>
          <div className="mt-6 border-t border-slate-100 pt-5">
            {captured ? (
              <p className="text-[13px] text-emerald-700">Got it — we&apos;ll be in touch.</p>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!email.trim()) return;
                  fetch("/api/fit/capture", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim() }) }).catch(() => {});
                  setCaptured(true);
                }}
                className="flex gap-2"
              >
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-indigo-400 focus:outline-none" />
                <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">Notify me</button>
              </form>
            )}
          </div>
        </>
      )}
    </div>
  );
}
