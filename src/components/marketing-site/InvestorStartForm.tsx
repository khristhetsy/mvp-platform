"use client";

import Link from "next/link";
import { useState } from "react";
import { investorStart } from "@/content/investor-start";
import { useVocabulary } from "@/lib/vocabulary/provider";
import { MultiSelectDropdown } from "@/components/marketing-site/MultiSelectDropdown";

/** Pill buttons the investor can select several of. */
function ChipGroup({ legend, options, value, onToggle }: Readonly<{ legend: string; options: readonly string[]; value: string[]; onToggle: (o: string) => void }>) {
  return (
    <fieldset className="mt-5">
      <legend className="sr-only">{legend}</legend>
      <div className="flex items-baseline justify-between gap-2" aria-hidden="true">
        <span className="text-[13px] font-medium text-site-navy">{legend}</span>
        <span className="text-[12px] text-site-muted">{investorStart.multiHint} · {value.length} selected</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onToggle(o)}
            aria-pressed={value.includes(o)}
            className={`min-h-10 rounded-full border px-4 text-[13px] font-medium transition-colors ${value.includes(o) ? "border-site-blue bg-site-blue text-white" : "border-site-line bg-white text-site-ink hover:border-site-blue-hi"}`}
          >
            {o}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Investor sign up intake: records the lead, then opens the account form set to investor (free). */
export function InvestorStartForm() {
  const f = investorStart.fields;
  const sectorOptions = useVocabulary("industry").options.map((o) => o.label);
  const [sectors, setSectors] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [checks, setChecks] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleIn = (set: React.Dispatch<React.SetStateAction<string[]>>) => (o: string) =>
    set((cur) => (cur.includes(o) ? cur.filter((x) => x !== o) : [...cur, o]));
  const emailsMismatch = confirmEmail.length > 0 && email.trim().toLowerCase() !== confirmEmail.trim().toLowerCase();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    if (email.trim().toLowerCase() !== confirmEmail.trim().toLowerCase()) {
      setError(f.confirmEmail.mismatch);
      return;
    }
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const details: Record<string, string | string[]> = {};
    if (types.length) details.investor_type = types;
    if (checks.length) details.check_size = checks;
    if (sectors.length) details.sectors = sectors;
    const payload = {
      name: String(fd.get("name") ?? "").trim() || undefined,
      email: String(fd.get("email") ?? "").trim(),
      company: String(fd.get("firm") ?? "").trim() || undefined,
      website: String(fd.get("website") ?? "").trim() || undefined,
      start_choice: "investor" as const,
      role: "investor" as const,
      details: Object.keys(details).length ? details : undefined,
      source_page: "/investors/start",
    };
    try {
      const res = await fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; redirect?: string; error?: string } | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "Something went wrong. Please try again.");
        setBusy(false);
        return;
      }
      window.location.href = data.redirect ?? "/auth/sign-up?role=investor";
    } catch {
      setError("Network error. Please try again.");
      setBusy(false);
    }
  }

  const inputCls = "mt-1 w-full rounded-lg border border-site-line bg-white px-3 py-2.5 text-sm text-site-ink outline-none focus:border-site-blue-hi";

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-site-line bg-white p-7">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-[13px] font-medium text-site-navy">Full name<input name="name" autoComplete="name" className={inputCls} /></label>
        <label className="text-[13px] font-medium text-site-navy">Work email<input name="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="name@fund.com" /></label>
        <div className="sm:col-span-2">
          <label className="text-[13px] font-medium text-site-navy">{f.confirmEmail.label}
            <input name="confirm_email" type="email" required autoComplete="off" value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} onPaste={(e) => e.preventDefault()} aria-invalid={emailsMismatch} aria-describedby={emailsMismatch ? "confirm-email-error" : undefined} className={`${inputCls} ${emailsMismatch ? "!border-red-600" : ""}`} placeholder="name@fund.com" />
          </label>
          {emailsMismatch ? <p id="confirm-email-error" role="alert" className="mt-1 text-[13px] text-red-700">{f.confirmEmail.mismatch}</p> : null}
        </div>
        <label className="text-[13px] font-medium text-site-navy">Firm<input name="firm" autoComplete="organization" className={inputCls} /></label>
        <label className="text-[13px] font-medium text-site-navy">Website<input name="website" inputMode="url" className={inputCls} placeholder="fund.com" /></label>
      </div>

      <ChipGroup legend={f.investorType.label} options={f.investorType.options} value={types} onToggle={toggleIn(setTypes)} />
      <ChipGroup legend={f.checkSize.label} options={f.checkSize.options} value={checks} onToggle={toggleIn(setChecks)} />

      <div className="mt-5">
        <MultiSelectDropdown label={f.sectors.label} options={sectorOptions} value={sectors} onChange={setSectors} placeholder={f.sectors.placeholder} searchPlaceholder={f.sectors.search} />
      </div>

      <p className="mt-5 rounded-lg bg-emerald-50 px-3 py-2.5 text-[13px] text-emerald-800">
        <span className="font-semibold">{investorStart.freeNote}</span> {investorStart.freeNoteSub}
      </p>

      {error ? <p className="mt-4 text-[13px] text-red-600" role="alert">{error}</p> : null}

      <button type="submit" disabled={busy} className="mt-5 w-full rounded-lg bg-site-blue px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi disabled:opacity-60">
        {busy ? "Creating…" : investorStart.submit}
      </button>
      <p className="mt-3 text-center text-[13px] text-site-muted">
        {investorStart.signinPrompt} <Link href="/auth/sign-in" className="font-medium text-site-blue hover:text-site-blue-hi">Sign in</Link>
        {" · "}
        {investorStart.founderPrompt} <Link href="/start" className="font-medium text-site-blue hover:text-site-blue-hi">Founder sign up</Link>
      </p>
      <p className="mt-4 text-[11px] leading-5 text-site-muted/80">{investorStart.terms}</p>
    </form>
  );
}
