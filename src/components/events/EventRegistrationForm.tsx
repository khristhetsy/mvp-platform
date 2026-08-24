"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Coins, Rocket, Briefcase, Store } from "lucide-react";
import type { AttendeeType } from "@/lib/icfo-events/registration-intake";
import { EVENT_SECTORS } from "@/lib/icfo-events/sectors";
import {
  type RegistrationField as Field,
  REGISTRATION_COMMON as COMMON,
  REGISTRATION_BY_TYPE as BY_TYPE,
} from "@/lib/icfo-events/registration-fields";

const ROLES: { key: AttendeeType; label: string; Icon: typeof Coins }[] = [
  { key: "investor", label: "Investor", Icon: Coins },
  { key: "founder", label: "Founder", Icon: Rocket },
  { key: "service", label: "Service Provider", Icon: Briefcase },
  { key: "sponsor", label: "Sponsor", Icon: Store },
];

export function EventRegistrationForm({ eventId, slug, defaultCompany, defaultEmail, defaultPhone, defaultName }: { eventId: string; slug: string; defaultCompany?: string; defaultEmail?: string; defaultPhone?: string; defaultName?: string }) {
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
      if (!f.required) continue;
      const v = answers[f.key];
      const filled = f.kind === "chips" ? Array.isArray(v) && v.length > 0 : String(v ?? "").trim().length > 0;
      if (!filled) { setError(`Please complete “${f.label}”.`); return; }
    }
    const email = String(answers.email ?? "").trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (interests.length === 0) { setError("Please pick at least one networking interest."); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendeeType: role, answers, interests }),
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
        <p className="text-lg font-medium text-[var(--navy)]">{t("you_re_registered")}</p>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{t("a_confirmation_is_in_your_notifications_see")}</p>
        <Link href={`/events/${slug}/lobby`} className="mt-4 inline-block rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ background: "#1D9E75" }}>
          Enter the lobby ↗
        </Link>
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
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">{COMMON.map(renderField)}</div>

        {role ? (
          <div className="mt-4 grid gap-3 border-t border-[var(--border-subtle)] pt-4">{BY_TYPE[role].map(renderField)}</div>
        ) : (
          <p className="mt-4 border-t border-[var(--border-subtle)] pt-4 text-sm text-[var(--text-muted)]">{t("pick_a_role_above_to_continue")}</p>
        )}

        <div className="mt-5 border-t border-[var(--border-subtle)] pt-4">
          <p className="text-sm font-medium text-[var(--navy)]">
            Networking interests <span className="text-rose-500">*</span>
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Pick at least one so we can match you with the right founders and investors. Names only — no contact details shared until both sides accept.
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
