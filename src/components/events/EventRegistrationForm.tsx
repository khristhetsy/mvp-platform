"use client";

import { useState } from "react";
import Link from "next/link";
import { Coins, Rocket, Briefcase, Store } from "lucide-react";
import { EVENT_SECTORS } from "@/lib/icfo-events/sectors";
import type { AttendeeType } from "@/lib/icfo-events/registration-intake";

type Field = {
  key: string;
  label: string;
  kind: "text" | "select" | "chips" | "textarea" | "checkbox";
  options?: string[];
};

const SECTORS = EVENT_SECTORS.map((s) => s.label);
const COUNTRIES = ["United States", "Canada", "United Kingdom", "Germany", "India", "Singapore", "Other"];

const ROLES: { key: AttendeeType; label: string; Icon: typeof Coins }[] = [
  { key: "investor", label: "Investor", Icon: Coins },
  { key: "founder", label: "Founder", Icon: Rocket },
  { key: "service", label: "Service Provider", Icon: Briefcase },
  { key: "sponsor", label: "Sponsor", Icon: Store },
];

const COMMON: Field[] = [
  { key: "company", label: "Company / firm", kind: "text" },
  { key: "title", label: "Title", kind: "text" },
  { key: "country", label: "Country", kind: "select", options: COUNTRIES },
];

const BY_TYPE: Record<AttendeeType, Field[]> = {
  investor: [
    { key: "investorType", label: "Investor type", kind: "select", options: ["Angel", "Venture Capital", "Private Equity", "Family Office", "LP", "Syndicate"] },
    { key: "checkSize", label: "Typical check size", kind: "select", options: ["< $25k", "$25k–$100k", "$100k–$500k", "$500k–$2M", "$2M+"] },
    { key: "stages", label: "Stage focus", kind: "chips", options: ["Pre-seed", "Seed", "Series A", "Series B+"] },
    { key: "sectors", label: "Sectors of interest", kind: "chips", options: SECTORS },
    { key: "thesis", label: "Investment thesis / what you look for", kind: "textarea" },
    { key: "accredited", label: "I am an accredited investor", kind: "checkbox" },
    { key: "openToIntros", label: "Open to founder intros?", kind: "select", options: ["Yes", "Only in my sectors", "Not now"] },
  ],
  founder: [
    { key: "stage", label: "Company stage", kind: "select", options: ["Idea", "Pre-seed", "Seed", "Series A", "Series B+"] },
    { key: "sector", label: "Sector", kind: "select", options: SECTORS },
    { key: "raising", label: "Currently raising?", kind: "select", options: ["Not raising", "Raising now", "In 3–6 months"] },
    { key: "roundSize", label: "Round size", kind: "select", options: ["< $250k", "$250k–$1M", "$1M–$3M", "$3M+"] },
    { key: "lookingFor", label: "Looking for", kind: "chips", options: ["Capital", "Investor intros", "Mentorship", "Partners", "Hiring"] },
    { key: "pitch", label: "One-line pitch", kind: "textarea" },
    { key: "applyToPresent", label: "Apply to present at the showcase", kind: "checkbox" },
  ],
  service: [
    { key: "serviceCategory", label: "Service category", kind: "select", options: ["Legal", "Banking", "Accounting", "Consulting", "Marketing", "Tech / Tools"] },
    { key: "whoYouServe", label: "Who you serve", kind: "select", options: ["Founders", "Investors", "Both"] },
    { key: "specialty", label: "Specialty / offer", kind: "textarea" },
    { key: "interestedIn", label: "Interested in", kind: "chips", options: ["Just attending", "A booth", "Sponsorship", "Speaking"] },
  ],
  sponsor: [
    { key: "tier", label: "Tier interest", kind: "select", options: ["Presenting", "Gold", "Silver", "Community", "Not sure"] },
    { key: "budget", label: "Budget range", kind: "select", options: ["< $5k", "$5k–$15k", "$15k–$40k", "$40k+"] },
    { key: "goals", label: "Goals", kind: "chips", options: ["Lead generation", "Brand awareness", "Recruiting", "Thought leadership"] },
    { key: "timeline", label: "Decision timeline", kind: "select", options: ["This week", "This month", "Exploring"] },
    { key: "notes", label: "Anything we should know?", kind: "textarea" },
  ],
};

export function EventRegistrationForm({ eventId, slug, defaultCompany }: { eventId: string; slug: string; defaultCompany?: string }) {
  const [role, setRole] = useState<AttendeeType | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>(defaultCompany ? { company: defaultCompany } : {});
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(key: string, value: unknown) {
    setAnswers((a) => ({ ...a, [key]: value }));
  }
  function toggleChip(key: string, opt: string) {
    setAnswers((a) => {
      const cur = Array.isArray(a[key]) ? (a[key] as string[]) : [];
      return { ...a, [key]: cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt] };
    });
  }

  function renderField(f: Field) {
    if (f.kind === "checkbox") {
      return (
        <label key={f.key} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <input type="checkbox" checked={Boolean(answers[f.key])} onChange={(e) => set(f.key, e.target.checked)} />
          {f.label}
        </label>
      );
    }
    if (f.kind === "chips") {
      const cur = Array.isArray(answers[f.key]) ? (answers[f.key] as string[]) : [];
      return (
        <div key={f.key}>
          <p className="mb-1.5 text-xs text-[var(--text-secondary)]">{f.label}</p>
          <div className="flex flex-wrap gap-1.5">
            {f.options!.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => toggleChip(f.key, o)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  cur.includes(o) ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-slate-50"
                }`}
              >
                {o}
              </button>
            ))}
          </div>
        </div>
      );
    }
    return (
      <label key={f.key} className="block">
        <span className="mb-1 block text-xs text-[var(--text-secondary)]">{f.label}</span>
        {f.kind === "select" ? (
          <select value={String(answers[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)} className="w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm">
            <option value="">Select…</option>
            {f.options!.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : f.kind === "textarea" ? (
          <textarea value={String(answers[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)} rows={2} className="w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm" />
        ) : (
          <input value={String(answers[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)} className="w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm" />
        )}
      </label>
    );
  }

  async function submit() {
    if (!role || !consent) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendeeType: role, answers }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Could not register.");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not register.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-white p-8 text-center shadow-[var(--shadow-card)]">
        <p className="text-lg font-medium text-[var(--navy)]">You&apos;re registered ✓</p>
        <p className="mt-1 text-sm text-[var(--text-muted)]">A confirmation is in your notifications. See you at the event.</p>
        <Link href={`/events/${slug}/lobby`} className="mt-4 inline-block rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ background: "#1D9E75" }}>
          Enter the lobby ↗
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-white shadow-[var(--shadow-card)]">
      <div className="px-5 py-4" style={{ background: "#0c2340" }}>
        <p className="text-[11px] tracking-wide" style={{ color: "#5DCAA5" }}>REGISTER · FREE</p>
        <p className="mt-1 text-base font-medium text-white">Tell us who you are</p>
      </div>
      <div className="p-5">
        <p className="mb-2 text-sm font-medium text-[var(--navy)]">I&apos;m registering as…</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ROLES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRole(r.key)}
              className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-colors ${
                role === r.key ? "border-[var(--teal,#1D9E75)] bg-[var(--indigo-soft)]" : "border-[var(--border-subtle)] hover:border-[var(--indigo)]"
              }`}
              style={role === r.key ? { borderColor: "#1D9E75", background: "#E1F5EE" } : undefined}
            >
              <r.Icon className="h-5 w-5" style={{ color: role === r.key ? "#0F6E56" : "#0c2340" }} />
              <span className="text-xs font-medium text-[var(--navy)]">{r.label}</span>
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">{COMMON.map(renderField)}</div>

        {role ? (
          <div className="mt-4 grid gap-3 border-t border-[var(--border-subtle)] pt-4">{BY_TYPE[role].map(renderField)}</div>
        ) : (
          <p className="mt-4 border-t border-[var(--border-subtle)] pt-4 text-sm text-[var(--text-muted)]">Pick a role above to continue.</p>
        )}

        <label className="mt-4 flex items-start gap-2 text-[11px] text-[var(--text-secondary)]">
          <input type="checkbox" className="mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>I understand this is an educational community event and not an offer of securities, and I agree to the privacy policy.</span>
        </label>

        <button
          onClick={submit}
          disabled={!role || !consent || busy}
          className="mt-4 w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          style={{ background: "#1D9E75" }}
        >
          {busy ? "Registering…" : "Complete registration"}
        </button>
        {error && <p className="mt-2 text-xs text-rose-700">{error}</p>}
      </div>
    </div>
  );
}
