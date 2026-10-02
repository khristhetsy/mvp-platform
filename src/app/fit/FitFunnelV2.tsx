"use client";

import { useEffect, useMemo, useState } from "react";
import { Q2_RAISE, Q5_INVESTOR_TYPE, type FitAnswers } from "@/lib/fit/options";
import { groupSectors, valuesForChips, type SectorGroup } from "@/lib/fit/sector-groups";
import type { PublicMatchResponse, PublicMatch } from "@/lib/fit/public-match";
import { FIT_BOOKING_FORM_DEFAULTS, resolveFitBookingForm, type FitBookingForm } from "@/lib/fit/booking-form-config";

/**
 * /fit v2: the Match Review flow (A/B test arm; v1 is FitFunnelClient).
 *
 * Four questions → the top five fits by firm name → one ask: book a 15 minute
 * Match Review where the team makes warm introductions to all five. Bookings go through the
 * existing scheduler API, which attributes them to this funnel session via the
 * fs_session cookie and hands the lead to Sales Hub.
 */

/** The iCFO host whose calendar takes Match Review calls (same as the v1 structuring call). */
const REVIEW_HOST_ID = "dc2f3667-ca80-4f35-a1cd-ba0c3adac510";
const REVIEW_MINUTES = 15;
const DAYS_AHEAD = 14;
const MAX_SECTORS = 2;
const TOTAL_STEPS = 4;

/** Q1 merges the old stage + revenue questions: one answer sets both. */
const Q1_COMPANY: { key: string; label: string; stage: string[]; revenue: string[] }[] = [
  { key: "pre", label: "Pre revenue", stage: ["pre_revenue"], revenue: ["pre_revenue"] },
  { key: "u1m", label: "Revenue under $1M", stage: ["revenue_pre_a"], revenue: ["under_1m"] },
  { key: "1to5", label: "Revenue $1M to $5M", stage: ["revenue_pre_a"], revenue: ["1m_5m"] },
  { key: "o5m", label: "Revenue over $5M", stage: ["series_a_plus"], revenue: ["over_5m"] },
];
const RAISE_TEXT: Record<string, string> = { under_1m: "Under $1M", "1m_10m": "$1M to $10M", over_10m: "Over $10M" };

const DISCLAIMER =
  "iCFO Capital Global, Inc. is not a registered broker-dealer, funding portal, investment adviser, or placement agent. It does not offer or sell securities, effect securities transactions, hold or transmit customer funds, or receive transaction-based compensation.";

function logEvent(eventName: "fit_v2_book_view" | "fit_v2_booked" | "fit_v2_list_email") {
  fetch("/api/fit/event", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventName }), keepalive: true }).catch(() => {});
}

function patchSession(body: Record<string, unknown>) {
  fetch("/api/fit/session", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => {});
}

function Logo() {
  return (
    <div className="flex justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icapos-logo.svg" alt="iCapOS" className="h-8 w-auto" />
    </div>
  );
}

function LockIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function FitRing({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const C = 2 * Math.PI * 18;
  return (
    <svg width="44" height="44" viewBox="0 0 46 46" role="img" aria-label={`${v}% fit`} className="flex-shrink-0">
      <circle cx="23" cy="23" r="18" fill="none" stroke="#E1F5EE" strokeWidth="5" />
      <circle cx="23" cy="23" r="18" fill="none" stroke="#1D9E75" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(v / 100) * C} ${C}`} transform="rotate(-90 23 23)" />
      <text x="23" y="27" textAnchor="middle" fontSize="12" fontWeight="600" fill="#0F6E56">{v}%</text>
    </svg>
  );
}

function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
}

function MatchCard({ m }: { m: PublicMatch }) {
  const sub = [m.title, m.detail].filter(Boolean).join(" · ");
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
      {m.company ? (
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[13px] font-semibold text-indigo-700" aria-hidden="true">{initials(m.company)}</span>
      ) : (
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><LockIcon /></span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-slate-900">{m.company ?? m.title}</p>
        <p className="mt-0.5 text-[12px] text-slate-500">{m.company ? sub : m.detail}</p>
      </div>
      <FitRing value={m.fit} />
    </div>
  );
}

function Progress({ n }: { n: number }) {
  return (
    <div className="flex items-center gap-3">
      <p className="font-mono text-xs uppercase tracking-wider text-indigo-600">Question {n} of {TOTAL_STEPS}</p>
      <div className="h-1 flex-1 rounded bg-indigo-100" aria-hidden="true">
        <div className="h-1 rounded bg-indigo-600" style={{ width: `${(n / TOTAL_STEPS) * 100}%` }} />
      </div>
    </div>
  );
}

function OptionButton({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={`min-h-12 w-full rounded-xl border px-4 py-3 text-left text-[15px] transition-colors ${on ? "border-2 border-indigo-600 bg-indigo-50 font-semibold text-indigo-800" : "border-slate-200 bg-white text-slate-800 hover:border-indigo-300"}`}>
      {label}
    </button>
  );
}

const card = "mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm";

type Step = 1 | 2 | 3 | 4 | "match" | "book" | "booked";

export function FitFunnelV2() {
  const [step, setStep] = useState<Step>(1);
  const [companyKey, setCompanyKey] = useState<string | null>(null);
  const [raise, setRaise] = useState<string | null>(null);
  const [chips, setChips] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [sectors, setSectors] = useState<string[]>([]);
  const [networkTotal, setNetworkTotal] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<PublicMatchResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [bookedAt, setBookedAt] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/fit/sectors").then((r) => (r.ok ? r.json() : null)).then((d) => {
      setSectors(Array.isArray(d?.sectors) ? d.sectors : []);
      setNetworkTotal(typeof d?.network_total === "number" ? d.network_total : null);
    }).catch(() => {});
  }, []);

  const groups: SectorGroup[] = useMemo(() => groupSectors(sectors), [sectors]);
  const company = Q1_COMPANY.find((o) => o.key === companyKey) ?? null;
  const chipLabel = (k: string) => groups.flatMap((g) => g.chips).find((c) => c.key === k)?.label ?? k;

  const answers: FitAnswers = {
    stage: company?.stage ?? [],
    raise: raise ? [raise] : [],
    industry: valuesForChips(groups, chips),
    revenue: company?.revenue ?? [],
    investorType: types.length ? types : ["any"],
  };
  const scope = [chips.map(chipLabel).join(", "), raise ? `raising ${RAISE_TEXT[raise] ?? raise}` : null, company?.label].filter(Boolean).join(" · ");

  async function runMatch() {
    setBusy(true);
    setStep("match");
    try {
      const res = await fetch("/api/fit/match", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...answers, variant: "v2" }) });
      setResult(res.ok ? await res.json() : null);
    } catch {
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  // ── Q1: company stage (first screen) ─────────────────────────────
  if (step === 1) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <Logo />
        <div className="text-center">
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-slate-900">See which investors fit your raise</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-slate-600">Four questions. Your top five matches from our network, ranked by fit.</p>
        </div>
        <div className="flex gap-2">
          {networkTotal ? (
            <div className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
              <p className="text-[12px] text-slate-500">In our network</p>
              <p className="text-[20px] font-bold text-slate-900">{networkTotal.toLocaleString()}</p>
            </div>
          ) : null}
          <div className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
            <p className="text-[12px] text-slate-500">You get</p>
            <p className="text-[20px] font-bold text-slate-900">Top 5</p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="font-mono text-[11px] uppercase tracking-wider text-slate-500">What your result looks like</p>
          <div className="mt-2.5 flex items-center gap-3">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[13px] font-semibold text-indigo-700" aria-hidden="true">VF</span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-slate-900">Investor firm name</p>
              <p className="text-[13px] text-slate-500">Type, your sector, check size and fit score</p>
            </div>
          </div>
          <p className="mt-2.5 text-[12px] text-slate-500">Warm introductions on your match review call.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <Progress n={1} />
          <h2 className="mt-3 text-[20px] font-bold text-slate-900">Where is your company today?</h2>
          <div className="mt-3 flex flex-col gap-2">
            {Q1_COMPANY.map((o) => (
              <OptionButton key={o.key} on={companyKey === o.key} label={o.label} onClick={() => {
                setCompanyKey(o.key);
                patchSession({ step: 1, stage: o.stage.join(", "), revenue: o.revenue.join(", ") });
                setStep(2);
              }} />
            ))}
          </div>
          <p className="mt-3 text-[12px] text-slate-500">Tap one to continue. No sign up needed to see results.</p>
        </div>
      </div>
    );
  }

  // ── Q2: raise ────────────────────────────────────────────────────
  if (step === 2) {
    return (
      <div className={card}>
        <Logo />
        <div className="mt-5"><Progress n={2} /></div>
        <h1 className="mt-3 text-[20px] font-bold text-slate-900">How much are you raising?</h1>
        <div className="mt-3 flex flex-col gap-2">
          {Q2_RAISE.map((o) => (
            <OptionButton key={o.key} on={raise === o.key} label={RAISE_TEXT[o.key] ?? o.label} onClick={() => {
              setRaise(o.key);
              patchSession({ step: 2, raise: o.key });
              setStep(3);
            }} />
          ))}
        </div>
        <button type="button" onClick={() => setStep(1)} className="mt-4 min-h-11 text-[14px] text-indigo-700 hover:underline">Back</button>
      </div>
    );
  }

  // ── Q3: grouped, searchable sectors ──────────────────────────────
  if (step === 3) {
    // Match from the start of a word, so "ai" finds AI but not entertAInment.
    const q = query.trim();
    const re = q ? new RegExp(`(^|[^a-z0-9])${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i") : null;
    const visible = groups
      .map((g) => ({ ...g, chips: g.chips.filter((c) => !re || re.test(c.label) || c.values.some((v) => re.test(v))) }))
      .filter((g) => g.chips.length > 0);
    const toggle = (k: string) => setChips((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : cur.length >= MAX_SECTORS ? cur : [...cur, k]));
    return (
      <div className={card}>
        <Logo />
        <div className="mt-5"><Progress n={3} /></div>
        <h1 className="mt-3 text-[20px] font-bold text-slate-900">What sector are you in?</h1>
        <p className="mt-1 text-[13px] text-slate-500">Pick up to {MAX_SECTORS}.</p>
        <label htmlFor="fit-sector-search" className="mt-4 block text-[13px] font-semibold text-slate-800">Search sectors</label>
        <input id="fit-sector-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Type a sector, for example AI"
          className="mt-1 h-12 w-full rounded-xl border border-slate-300 px-3 text-[15px] focus:border-indigo-500 focus:outline-none" />
        {chips.length ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[12px] text-slate-500">Selected:</span>
            {chips.map((k) => (
              <button key={k} type="button" onClick={() => toggle(k)} className="min-h-9 rounded-full bg-indigo-600 px-3 text-[13px] font-semibold text-white" aria-label={`Remove ${chipLabel(k)}`}>
                {chipLabel(k)} ×
              </button>
            ))}
          </div>
        ) : null}
        <div className="mt-4 flex max-h-[420px] flex-col gap-4 overflow-y-auto pr-1">
          {sectors.length === 0 ? <p className="text-sm text-slate-400">Loading sectors…</p> : visible.length === 0 ? (
            <p className="text-sm text-slate-500">No sector matches &ldquo;{query}&rdquo;. Try a broader word, or pick Other.</p>
          ) : visible.map((g) => (
            <div key={g.name}>
              <p className="font-mono text-[11px] uppercase tracking-wider text-slate-500">{g.name}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {g.chips.map((c) => {
                  const on = chips.includes(c.key);
                  const full = !on && chips.length >= MAX_SECTORS;
                  return (
                    <button key={c.key} type="button" onClick={() => toggle(c.key)} aria-pressed={on} disabled={full}
                      className={`min-h-11 rounded-full border px-3.5 text-[14px] transition-colors disabled:opacity-40 ${on ? "border-2 border-indigo-600 bg-indigo-50 font-semibold text-indigo-800" : "border-slate-200 bg-white text-slate-800 hover:border-indigo-300"}`}>
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <button type="button" disabled={chips.length === 0} onClick={() => {
          patchSession({ step: 3, industry: answers.industry.join(", ").slice(0, 600) });
          setStep(4);
        }} className="mt-5 min-h-12 w-full rounded-xl bg-indigo-600 px-5 text-[15px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-40">
          Continue{chips.length ? ` · ${chips.length} selected` : ""}
        </button>
        <button type="button" onClick={() => setStep(2)} className="mt-2 min-h-11 text-[14px] text-indigo-700 hover:underline">Back</button>
      </div>
    );
  }

  // ── Q4: investor type ────────────────────────────────────────────
  if (step === 4) {
    const toggleType = (k: string) => setTypes((cur) => {
      if (k === "any") return cur.includes("any") ? [] : ["any"];
      const base = cur.filter((x) => x !== "any");
      return base.includes(k) ? base.filter((x) => x !== k) : [...base, k];
    });
    return (
      <div className={card}>
        <Logo />
        <div className="mt-5"><Progress n={4} /></div>
        <h1 className="mt-3 text-[20px] font-bold text-slate-900">What type of investor are you looking for?</h1>
        <p className="mt-1 text-[13px] text-slate-500">Select all that apply.</p>
        <div className="mt-3 flex flex-col gap-2">
          {Q5_INVESTOR_TYPE.map((o) => <OptionButton key={o.key} on={types.includes(o.key)} label={o.label} onClick={() => toggleType(o.key)} />)}
        </div>
        <button type="button" disabled={types.length === 0} onClick={() => { patchSession({ step: 4 }); void runMatch(); }}
          className="mt-5 min-h-12 w-full rounded-xl bg-indigo-600 px-5 text-[15px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-40">
          See my top 5
        </button>
        <button type="button" onClick={() => setStep(3)} className="mt-2 min-h-11 text-[14px] text-indigo-700 hover:underline">Back</button>
      </div>
    );
  }

  // ── Booking ──────────────────────────────────────────────────────
  if (step === "book") {
    return <ReviewBooker scope={scope} onBack={() => setStep("match")} onBooked={(at) => { setBookedAt(at); setStep("booked"); }} />;
  }

  if (step === "booked") {
    const when = bookedAt ? new Date(bookedAt).toLocaleString(undefined, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
    return (
      <div className={card}>
        <Logo />
        <h1 className="mt-5 text-[22px] font-bold text-slate-900">Your match review is booked</h1>
        <p className="mt-2 text-[15px] text-slate-600">{when}. The calendar invite with the video link is on its way to your inbox.</p>
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-[13px] leading-relaxed text-emerald-900">
          <p className="font-semibold">What you get on the call</p>
          <p className="mt-1">Warm introductions to your matches. Who to approach first and why. Your raise scope is saved, so nothing gets asked twice.</p>
        </div>
      </div>
    );
  }

  // ── Results ──────────────────────────────────────────────────────
  const top = result?.top ?? [];
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <Logo />
      {busy ? (
        <div className={card}><p className="text-center text-sm text-slate-500">Matching against our network…</p></div>
      ) : top.length > 0 ? (
        <>
          <div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-wider text-emerald-700">Your top fits</p>
                <h1 className="mt-1 text-[24px] font-bold leading-tight tracking-tight text-slate-900">{top.length} investor{top.length === 1 ? "" : "s"} fit your raise</h1>
              </div>
              <span className="mt-0.5 inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-medium text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/25" /> Live data
              </span>
            </div>
            <p className="mt-1 text-[13px] text-slate-500">{scope}</p>
            <p className="mt-1 text-[13px] text-slate-500">Only investors whose sector fits, and whose check size fits when they state one.</p>
          </div>
          <div className="flex flex-col gap-2">{top.map((m) => <MatchCard key={m.key} m={m} />)}</div>
          <div className="rounded-2xl border-2 border-indigo-600 bg-white p-5">
            <h2 className="text-[18px] font-bold text-slate-900">Get a warm intro, not a cold email</h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-slate-600">A {REVIEW_MINUTES} minute match review with our team. We introduce you to all {top.length} and tell you who to approach first.</p>
            <button type="button" onClick={() => { logEvent("fit_v2_book_view"); setStep("book"); }}
              className="mt-3 min-h-12 w-full rounded-xl bg-indigo-600 px-5 text-[16px] font-semibold text-white hover:bg-indigo-700">
              Book my match review
            </button>
            <p className="mt-2 text-center text-[12px] text-slate-500">Pick a time on the next screen. No payment.</p>
          </div>
          <EmailList label="Not ready to talk? Leave your email and our team will send you this list." />
          <p className="text-[11px] leading-5 text-slate-400">{DISCLAIMER}</p>
        </>
      ) : (
        <div className={card}>
          <h1 className="text-[22px] font-semibold leading-snug text-slate-900">No investors in our network match this profile yet</h1>
          <p className="mt-1.5 text-[13px] text-slate-500">{scope}. Leave your email and we&apos;ll tell you when one does.</p>
          <div className="mt-5"><EmailList label="Your email" /></div>
        </div>
      )}
    </div>
  );
}

function EmailList({ label }: { label: string }) {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  if (done) return <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[13px] text-emerald-800">Got it. We&apos;ll be in touch.</p>;
  return (
    <form className="rounded-2xl border border-slate-200 bg-white p-4" onSubmit={(e) => {
      e.preventDefault();
      if (!email.trim()) return;
      fetch("/api/fit/capture", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim() }) }).catch(() => {});
      logEvent("fit_v2_list_email");
      setDone(true);
    }}>
      <label htmlFor="fit-v2-email" className="text-[14px] font-semibold text-slate-900">{label}</label>
      <div className="mt-2 flex gap-2">
        <input id="fit-v2-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com"
          className="h-12 min-w-0 flex-1 rounded-xl border border-slate-300 px-3 text-[15px] focus:border-indigo-500 focus:outline-none" />
        <button type="submit" className="h-12 rounded-xl border border-indigo-600 px-4 text-[15px] font-semibold text-indigo-700 hover:bg-indigo-50">Send</button>
      </div>
    </form>
  );
}

type Slot = { start: string; end: string };

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Inline booker: open slots from the host's calendar, then name, email, company. */
function ReviewBooker({ scope, onBack, onBooked }: { scope: string; onBack: () => void; onBooked: (startIso: string) => void }) {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [pick, setPick] = useState<Slot | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [form, setForm] = useState<FitBookingForm>(FIT_BOOKING_FORM_DEFAULTS);
  const [replies, setReplies] = useState<Record<string, string[]>>({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" : "UTC";

  useEffect(() => {
    fetch("/api/fit/booking-form").then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (d?.form) setForm(resolveFitBookingForm(d.form));
    }).catch(() => {});
  }, []);

  const cf = form.contactFields;
  const setReply = (id: string, value: string, mode: "set" | "toggle") => setReplies((p) => {
    const cur = p[id] ?? [];
    if (mode === "set") return { ...p, [id]: value ? [value] : [] };
    return { ...p, [id]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] };
  });

  useEffect(() => {
    const from = new Date();
    const to = new Date(from.getTime() + DAYS_AHEAD * 24 * 60 * 60 * 1000);
    const qs = new URLSearchParams({ host: REVIEW_HOST_ID, from: from.toISOString(), to: to.toISOString(), duration: String(REVIEW_MINUTES) });
    fetch(`/api/scheduling/slots?${qs}`).then((r) => (r.ok ? r.json() : null)).then((d) => {
      const list: Slot[] = Array.isArray(d?.slots) ? d.slots : [];
      const future = list.filter((s) => Date.parse(s.start) > Date.now() + 30 * 60 * 1000);
      setSlots(future);
      if (future.length) setDay(dayKey(future[0].start));
    }).catch(() => setSlots([]));
  }, []);

  const days = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of slots ?? []) if (!seen.has(dayKey(s.start))) seen.set(dayKey(s.start), s.start);
    return [...seen.entries()].slice(0, 8);
  }, [slots]);
  const daySlots = (slots ?? []).filter((s) => day && dayKey(s.start) === day);
  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const fmtDay = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pick) return;
    const missing = form.questions.find((q) => q.required && !(replies[q.id] ?? []).some((v) => v.trim()));
    if (missing) { setError(`Answer "${missing.label}" to book.`); return; }
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/scheduling/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostId: REVIEW_HOST_ID,
          startTime: pick.start,
          endTime: pick.end,
          timezone: tz,
          name: name.trim(),
          email: email.trim(),
          phone: cf.phone.collect ? phone.trim() || undefined : undefined,
          company: cf.company.collect ? companyName.trim() || undefined : undefined,
          note: "Match Review booked from icapos.com/fit",
          answers: [
            { label: "Booked from", value: "Fit match review" },
            { label: "Raise scope", value: scope.slice(0, 1000) },
            ...form.questions
              .map((q) => ({ label: q.label.slice(0, 300), value: (replies[q.id] ?? []).map((v) => v.trim()).filter(Boolean).join(", ").slice(0, 1000) }))
              .filter((a) => a.value),
          ],
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setError(typeof d?.error === "string" ? d.error : "That time could not be booked. Please pick another.");
        return;
      }
      logEvent("fit_v2_booked");
      onBooked(pick.start);
    } catch {
      setError("That time could not be booked. Please pick another.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="min-h-11 text-[14px] text-indigo-700 hover:underline">Back to matches</button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icapos-logo.svg" alt="iCapOS" className="h-7 w-auto" />
      </div>
      <div>
        <h1 className="text-[24px] font-bold leading-tight tracking-tight text-slate-900">Book your match review</h1>
        <p className="mt-1 text-[14px] text-slate-600">{REVIEW_MINUTES} minutes, video call. Times shown in your time zone.</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        {slots === null ? <p className="text-sm text-slate-500">Loading open times…</p> : days.length === 0 ? (
          <p className="text-sm text-slate-600">No open times in the next two weeks. Leave your email on the previous screen and we&apos;ll reach out.</p>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-2">
              {days.map(([k, iso]) => (
                <button key={k} type="button" onClick={() => { setDay(k); setPick(null); }} aria-pressed={day === k}
                  className={`min-h-12 rounded-xl border text-[14px] ${day === k ? "border-2 border-indigo-600 bg-indigo-50 font-semibold text-indigo-800" : "border-slate-200 bg-white text-slate-800"}`}>
                  {fmtDay(iso)}
                </button>
              ))}
            </div>
            <div className="mt-3 grid max-h-56 grid-cols-3 gap-2 overflow-y-auto">
              {daySlots.map((s) => (
                <button key={s.start} type="button" onClick={() => setPick(s)} aria-pressed={pick?.start === s.start}
                  className={`min-h-12 rounded-xl border text-[14px] ${pick?.start === s.start ? "border-2 border-indigo-600 bg-indigo-50 font-semibold text-indigo-800" : "border-slate-200 bg-white text-slate-800"}`}>
                  {fmtTime(s.start)}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4">
          <div>
            <label htmlFor="fr-name" className="text-[13px] font-semibold text-slate-800">{cf.name.label}</label>
            <input id="fr-name" required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="mt-1 h-12 w-full rounded-xl border border-slate-300 px-3 text-[15px] focus:border-indigo-500 focus:outline-none" />
          </div>
          <div>
            <label htmlFor="fr-email" className="text-[13px] font-semibold text-slate-800">{cf.email.label}</label>
            <input id="fr-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className="mt-1 h-12 w-full rounded-xl border border-slate-300 px-3 text-[15px] focus:border-indigo-500 focus:outline-none" />
          </div>
          {cf.phone.collect ? (
            <div>
              <label htmlFor="fr-phone" className="text-[13px] font-semibold text-slate-800">{cf.phone.label}{cf.phone.required ? "" : <span className="font-normal text-slate-400"> (optional)</span>}</label>
              <input id="fr-phone" type="tel" required={cf.phone.required} maxLength={40} value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" className="mt-1 h-12 w-full rounded-xl border border-slate-300 px-3 text-[15px] focus:border-indigo-500 focus:outline-none" />
            </div>
          ) : null}
          {cf.company.collect ? (
            <div>
              <label htmlFor="fr-company" className="text-[13px] font-semibold text-slate-800">{cf.company.label}{cf.company.required ? "" : <span className="font-normal text-slate-400"> (optional)</span>}</label>
              <input id="fr-company" required={cf.company.required} maxLength={200} value={companyName} onChange={(e) => setCompanyName(e.target.value)} autoComplete="organization" className="mt-1 h-12 w-full rounded-xl border border-slate-300 px-3 text-[15px] focus:border-indigo-500 focus:outline-none" />
            </div>
          ) : null}
          {form.questions.map((q) => (
            <fieldset key={q.id}>
              <legend className="text-[13px] font-semibold text-slate-800">{q.label}{q.required ? "" : <span className="font-normal text-slate-400"> (optional)</span>}</legend>
              {q.type === "short_text" ? (
                <input aria-label={q.label} required={q.required} maxLength={1000} value={(replies[q.id] ?? [""])[0] ?? ""} onChange={(e) => setReply(q.id, e.target.value, "set")} className="mt-1 h-12 w-full rounded-xl border border-slate-300 px-3 text-[15px] focus:border-indigo-500 focus:outline-none" />
              ) : (
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {q.options.map((o) => {
                    const on = (replies[q.id] ?? []).includes(o);
                    return (
                      <button key={o} type="button" aria-pressed={on} onClick={() => setReply(q.id, on && q.type === "single" ? "" : o, q.type === "single" ? "set" : "toggle")}
                        className={`min-h-10 rounded-xl border px-3 text-[14px] ${on ? "border-2 border-indigo-600 bg-indigo-50 font-semibold text-indigo-800" : "border-slate-200 bg-white text-slate-800"}`}>
                        {o}
                      </button>
                    );
                  })}
                </div>
              )}
            </fieldset>
          ))}
        </div>
        {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-[13px] text-red-800" role="alert">{error}</p> : null}
        <button type="submit" disabled={!pick || sending}
          className="min-h-12 w-full rounded-xl bg-indigo-600 px-5 text-[16px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-40">
          {sending ? "Booking…" : pick ? `Confirm ${new Date(pick.start).toLocaleDateString(undefined, { weekday: "short" })}, ${fmtTime(pick.start)}` : "Pick a time"}
        </button>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-[13px] leading-relaxed text-emerald-900">
          <p className="font-semibold">What you get on the call</p>
          <p className="mt-1">Warm introductions to your matches. Who to approach first and why. Your raise scope is saved, so nothing gets asked twice.</p>
        </div>
      </form>
    </div>
  );
}
