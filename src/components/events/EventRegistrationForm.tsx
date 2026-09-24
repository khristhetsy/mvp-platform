"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Coins, Rocket, Briefcase, Store } from "lucide-react";
import type { AttendeeType } from "@/lib/icfo-events/registration-intake";
import { EVENT_SECTORS } from "@/lib/icfo-events/sectors";
import {
  type RegistrationField as Field,
  REGISTRATION_COMMON as CODE_COMMON,
  REGISTRATION_BY_TYPE as CODE_BY_TYPE,
} from "@/lib/icfo-events/registration-fields";
import { resolveAll, type FieldSet } from "@/lib/icfo-events/registration-field-sets";

const ROLES: { key: AttendeeType; label: string; Icon: typeof Coins; leads: string }[] = [
  { key: "investor", label: "Investor", Icon: Coins, leads: "See founders raising in your sectors. iCapOS is free for investors." },
  { key: "founder", label: "Founder", Icon: Rocket, leads: "Meet investors whose sectors match yours." },
  { key: "service", label: "Service Provider", Icon: Briefcase, leads: "Meet founders and investors who need your service." },
  { key: "sponsor", label: "Sponsor", Icon: Store, leads: "Your booth, leads and sponsor page." },
];

/** Role fields the single sector question replaces. */
const SECTOR_KEYS = new Set(["sectors", "sector"]);

/** Where "Sign up" goes, from the event page and the match list. */
const SIGN_UP_URL = "https://icapos.com/start";

type Match = { role: "founder" | "investor"; type: string | null; shared: string[]; strength: "Strong" | "Match" };

function matchWho(m: Match): string {
  return m.role === "investor" ? `Investor${m.type ? ` · ${m.type}` : ""}` : `Founder${m.type ? ` · ${m.type}` : ""}`;
}

const SECTOR_QUESTION: Record<AttendeeType, string> = {
  founder: "Which sectors are you in?",
  investor: "Which sectors do you invest in?",
  service: "Which sectors do you work with?",
  sponsor: "Which sectors do you want to reach?",
};

export function EventRegistrationForm({ slug, defaultCompany, defaultEmail, defaultPhone, defaultName, fieldSet, signedIn = true }: { eventId: string; slug: string; defaultCompany?: string; defaultEmail?: string; defaultPhone?: string; defaultName?: string; fieldSet?: FieldSet; /** False for visitors registering without an account. */ signedIn?: boolean }) {
  // The saved set when the page loaded one; otherwise the code constants, so
  // the form renders even if the table is empty or unreachable.
  const COMMON: Field[] = fieldSet ? resolveAll(fieldSet.common) : CODE_COMMON;
  const BY_TYPE: Record<string, Field[]> = fieldSet
    ? Object.fromEntries(Object.entries(fieldSet.byType).map(([k, v]) => [k, resolveAll(v)]))
    : CODE_BY_TYPE;
  const t = useTranslations("eventsCmp");
  const [role, setRole] = useState<AttendeeType | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({
    ...(defaultName ? { name: defaultName } : {}),
    ...(defaultCompany ? { company: defaultCompany } : {}),
    ...(defaultEmail ? { email: defaultEmail } : {}),
    ...(defaultPhone ? { phone: defaultPhone } : {}),
  });
  const [consent, setConsent] = useState(false);
  const [interests, setInterests] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [gate, setGate] = useState(false);

  // Live matches: founders and investors only, as on the networking board.
  const matchRole = role === "founder" || role === "investor" ? role : null;
  const sectorLabels = EVENT_SECTORS.filter((s) => interests.includes(s.slug)).map((s) => s.label);
  const sectorKey = sectorLabels.join("|");
  useEffect(() => {
    // Nothing to ask; the panel is hidden while no sector is picked.
    if (!matchRole || !sectorKey) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/events/${slug}/matches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: matchRole, sectors: sectorKey.split("|"), email: typeof answers.email === "string" ? answers.email : undefined }),
        signal: ctrl.signal,
      })
        .then((r) => (r.ok ? r.json() : { matches: [] }))
        .then((j: { matches?: Match[] }) => setMatches(j.matches ?? []))
        .catch(() => undefined);
    }, 350);
    return () => { clearTimeout(timer); ctrl.abort(); };
    // answers.email only narrows out the registrant's own earlier row.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, matchRole, sectorKey, done]);

  function toggleInterest(slug: string) {
    setInterests((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
  }

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
        <span className="mb-1 block text-xs text-[var(--text-secondary)]">
          {f.label}{f.required ? <span className="text-rose-500"> *</span> : null}
        </span>
        {f.kind === "select" ? (
          <select value={String(answers[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)} className="w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm">
            <option value="">Select…</option>
            {f.options!.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : f.kind === "textarea" ? (
          <textarea value={String(answers[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)} rows={2} className="w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm" />
        ) : (
          <input
            type={f.key === "email" ? "email" : f.key === "phone" ? "tel" : "text"}
            value={String(answers[f.key] ?? "")}
            onChange={(e) => set(f.key, e.target.value)}
            className="w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
          />
        )}
      </label>
    );
  }

  async function submit() {
    if (!role || !consent) return;
    // Every required field must be filled (selects/text/textarea non-empty, chips ≥1).
    const fields: Field[] = [...COMMON, ...BY_TYPE[role]];
    for (const f of fields) {
      if (!f.required || SECTOR_KEYS.has(f.key)) continue;
      const v = answers[f.key];
      const filled = f.kind === "chips" ? Array.isArray(v) && v.length > 0 : String(v ?? "").trim().length > 0;
      if (!filled) { setError(`Please complete “${f.label}”.`); return; }
    }
    const email = String(answers.email ?? "").trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (interests.length === 0) { setError("Please pick at least one sector."); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${slug}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The one sector question fills the fields matching reads for every role.
        body: JSON.stringify({ attendeeType: role, answers: { ...answers, sectors: sectorLabels, ...(role === "founder" ? { sector: sectorLabels[0] } : {}) }, interests }),
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

  const gateModal = gate ? (
    <div role="dialog" aria-modal="true" aria-label="Sign up to see full profiles" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setGate(false)}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 text-left shadow-xl" onClick={(e) => e.stopPropagation()}>
        <p className="text-lg font-semibold text-[var(--navy)]">Sign up to see full profiles</p>
        {role === "investor" ? (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800"><b>iCapOS is free for investors.</b> No subscription, no card.</p>
        ) : null}
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          Create your iCapOS account to see names, companies and profiles, and to request introductions.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <a href={SIGN_UP_URL} className="rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ background: "#1D9E75" }}>
            {role === "investor" ? "Sign up free on iCapOS" : "Sign up on iCapOS"}
          </a>
          <button type="button" onClick={() => setGate(false)} className="rounded-lg border border-[var(--border-subtle)] px-4 py-2 text-sm">Not now</button>
        </div>
      </div>
    </div>
  ) : null;

  if (done) {
    return (
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-white p-6 shadow-[var(--shadow-card)]">
        <p className="text-lg font-medium text-[var(--navy)]">{t("you_re_registered")}</p>
        {signedIn ? <p className="mt-1 text-sm text-[var(--text-muted)]">{t("a_confirmation_is_in_your_notifications_see")}</p> : null}
        {matchRole && matches ? (
          <div className="mt-5">
            <p className="text-sm font-medium text-[var(--navy)]">
              {matches.length ? `${matches.length} ${matches.length === 1 ? "person here matches" : "people here match"} you` : "No matches yet. More people register every day."}
            </p>
            {matches.length ? (
              <ul className="mt-2 divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border-subtle)]">
                {matches.map((m, i) => (
                  <li key={`${m.role}-${i}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                    <span className="text-sm">
                      <b className="text-[var(--navy)]">{matchWho(m)}</b>
                      <span className="block text-xs text-[var(--text-muted)]">Shares {m.shared.join(", ")}{m.role !== matchRole ? ` · ${m.role} meets ${matchRole}` : ""}</span>
                    </span>
                    {signedIn ? (
                      <Link href={`/events/${slug}/lobby`} className="rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-medium">View in networking</Link>
                    ) : (
                      <button type="button" onClick={() => setGate(true)} className="rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-medium">View full profile</button>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        {signedIn ? (
          <Link href={`/events/${slug}/lobby`} className="mt-5 inline-block rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ background: "#1D9E75" }}>
            Enter the lobby ↗
          </Link>
        ) : (
          <p className="mt-5 text-sm text-[var(--text-muted)]">
            Want the full event experience? <a href={SIGN_UP_URL} className="font-medium text-[var(--navy)] underline">Sign up on iCapOS</a>{role === "investor" ? ", free for investors." : "."}
          </p>
        )}
        {gateModal}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-white shadow-[var(--shadow-card)]">
      <div className="px-5 py-4" style={{ background: "#0c2340" }}>
        <p className="text-[11px] tracking-wide" style={{ color: "#5DCAA5" }}>{t("register_free")}</p>
        <p className="mt-1 text-base font-medium text-white">{t("tell_us_who_you_are")}</p>
      </div>
      <div className="p-5">
        <p className="mb-2 text-sm font-medium text-[var(--navy)]">{t("i_m_registering_as")}</p>
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
              <span className="text-[10.5px] leading-snug text-[var(--text-muted)]">{r.leads}</span>
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">{COMMON.map(renderField)}</div>

        {role ? (
          <div className="mt-4 grid gap-3 border-t border-[var(--border-subtle)] pt-4">{BY_TYPE[role].filter((f) => !SECTOR_KEYS.has(f.key)).map(renderField)}</div>
        ) : (
          <p className="mt-4 border-t border-[var(--border-subtle)] pt-4 text-sm text-[var(--text-muted)]">{t("pick_a_role_above_to_continue")}</p>
        )}

        <div className="mt-5 border-t border-[var(--border-subtle)] pt-4">
          <p className="text-sm font-medium text-[var(--navy)]">
            {role ? SECTOR_QUESTION[role] : "Your sectors"} <span className="text-rose-500">*</span>
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Pick all that apply. This one answer drives your matches here, the networking board and introductions. No contact details are shared until both sides accept.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {EVENT_SECTORS.map((s) => {
              const on = interests.includes(s.slug);
              return (
                <button
                  key={s.slug}
                  type="button"
                  onClick={() => toggleInterest(s.slug)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    on ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-slate-50"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
          {matchRole && interests.length > 0 && matches ? (
            <div className="mt-3 rounded-xl border border-[var(--border-subtle)] bg-slate-50 p-3" aria-live="polite">
              <p className="text-xs font-semibold text-[var(--navy)]">
                {matches.length ? `Already registered who match you: ${matches.length}` : "No one registered matches these sectors yet."}
              </p>
              {matches.slice(0, 3).map((m, i) => (
                <p key={`${m.role}-${i}`} className="mt-1.5 text-xs text-[var(--text-secondary)]">
                  <b>{matchWho(m)}</b> · shares {m.shared.join(", ")} {m.strength === "Strong" ? <span className="ml-1 rounded bg-emerald-50 px-1.5 text-[10px] font-semibold text-emerald-700">Strong</span> : null}
                </p>
              ))}
              <p className="mt-2 text-[11px] text-[var(--text-muted)]">Names, companies and contact details stay hidden{signedIn ? "." : " until you sign up."}</p>
            </div>
          ) : null}
        </div>

        <label className="mt-4 flex items-start gap-2 text-[11px] text-[var(--text-secondary)]">
          <input type="checkbox" className="mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>I understand this is an educational community event and not an offer of securities, and I agree to the privacy policy.</span>
        </label>

        <button
          type="button"
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
