"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Q1_STAGE, Q2_RAISE, Q4_REVENUE, type FitAnswers } from "@/lib/fit/options";

type MatchResult = {
  contactId: string; company: string; summary: string; fit: number;
  sectors: string[]; stage: string | null; checkSize: string | null; revenue: string | null;
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
          </div>
        </div>
      ) : null}
    </div>
  );
}

const RAISE_LABEL: Record<string, string> = Object.fromEntries(Q2_RAISE.map((o) => [o.key, o.label]));
const STAGE_LABEL: Record<string, string> = Object.fromEntries(Q1_STAGE.map((o) => [o.key, o.label]));
const REV_LABEL: Record<string, string> = Object.fromEntries(Q4_REVENUE.map((o) => [o.key, o.label]));

function Opt({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-left text-[15px] font-medium text-slate-800 transition-colors hover:border-indigo-400 hover:bg-indigo-50/40">
      {label}
    </button>
  );
}

function FunnelHeader() {
  return (
    <div className="mb-6 flex flex-col items-center text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icapos-logo.svg" alt="iCapOS" className="h-8 w-auto" />
      <p className="mt-3 text-[13.5px] leading-relaxed text-slate-500">
        Answer four quick questions and instantly see the investors in our network that match your raise.
      </p>
    </div>
  );
}

function Q({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md">
      <FunnelHeader />
      <p className="font-mono text-xs uppercase tracking-wider text-indigo-500">Question {n} of 4</p>
      <h1 className="mt-2 text-[22px] font-semibold leading-snug text-slate-900">{title}</h1>
      <div className="mt-5 flex flex-col gap-2.5">{children}</div>
    </div>
  );
}

export function FitFunnelClient() {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | "match" | "method">(1);
  const [answers, setAnswers] = useState<Partial<FitAnswers>>({});
  const [sectors, setSectors] = useState<string[]>([]);
  const [result, setResult] = useState<MatchResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [captured, setCaptured] = useState(false);

  useEffect(() => {
    fetch("/api/fit/sectors").then((r) => (r.ok ? r.json() : null)).then((d) => setSectors(d?.sectors ?? [])).catch(() => {});
    // Session row on landing, before any answer. Attribution tag from ?s= (else direct).
    const tag = new URLSearchParams(window.location.search).get("s");
    fetch("/api/fit/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceTag: tag }) }).catch(() => {});
  }, []);

  // Field → the question number it answers (last_step diagnostic).
  const STEP_OF: Record<keyof FitAnswers, number> = { stage: 1, raise: 2, industry: 3, revenue: 4 };

  async function runMatch(final: FitAnswers) {
    setBusy(true);
    setStep("match");
    try {
      const res = await fetch("/api/fit/match", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(final) });
      setResult(res.ok ? await res.json() : { matched_count: 0, top: [], locked_count: 0, thin: true });
    } catch {
      setResult({ matched_count: 0, top: [], locked_count: 0, thin: true });
    } finally {
      setBusy(false);
    }
  }

  function choose(field: keyof FitAnswers, value: string, next: 2 | 3 | 4 | "done") {
    const merged = { ...answers, [field]: value } as FitAnswers;
    setAnswers(merged);
    // Record the answer + last_step server-side (fire-and-forget).
    fetch("/api/fit/session", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ step: STEP_OF[field], [field]: value }) }).catch(() => {});
    if (next === "done") void runMatch(merged);
    else setStep(next);
  }

  if (step === 1) return <Q n={1} title="Where are you today?">{Q1_STAGE.map((o) => <Opt key={o.key} label={o.label} onClick={() => choose("stage", o.key, 2)} />)}</Q>;
  if (step === 2) return <Q n={2} title="How much are you raising?">{Q2_RAISE.map((o) => <Opt key={o.key} label={o.label} onClick={() => choose("raise", o.key, 3)} />)}</Q>;
  if (step === 3) return (
    <Q n={3} title="What sector are you in?">
      {sectors.length === 0 ? <p className="text-sm text-slate-400">Loading sectors…</p> : sectors.map((s) => <Opt key={s} label={s} onClick={() => choose("industry", s, 4)} />)}
    </Q>
  );
  if (step === 4) return <Q n={4} title="What is your revenue?">{Q4_REVENUE.map((o) => <Opt key={o.key} label={o.key === "over_5m" ? `${o.label}` : o.label} onClick={() => choose("revenue", o.key, "done")} />)}</Q>;

  // Match screen
  const a = answers as FitAnswers;
  const subline = `${a.industry}, raising ${RAISE_LABEL[a.raise] ?? a.raise}, ${REV_LABEL[a.revenue] ?? a.revenue} revenue · ${STAGE_LABEL[a.stage] ?? a.stage}`;
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
        <h1 className="mt-3 text-[22px] font-semibold leading-snug text-slate-900">Run this raise through an SPV</h1>
        <p className="mt-1.5 text-[13px] text-slate-500">One vehicle, one cap table line, one close — scoped to your raise.</p>

        <div className="relative mt-6 pl-7">
          <span className="absolute bottom-1.5 left-[11px] top-1.5 w-0.5 bg-gradient-to-b from-indigo-600 to-indigo-200" aria-hidden="true" />
          {[
            { t: "Form the vehicle", d: "We set up the SPV for this raise" },
            { t: "Materials go out", d: `To your ${count || "matched"} matched investors` },
            { t: "They subscribe", d: "Into the SPV" },
            { t: "Funded", d: "Diligence runs through to close", done: true },
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
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-center text-[12.5px] text-slate-500">
                <i className="ti ti-lock" aria-hidden="true" /> {result!.locked_count} more matched
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
