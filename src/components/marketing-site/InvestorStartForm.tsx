"use client";

import Link from "next/link";
import { useState } from "react";
import { investorStart } from "@/content/investor-start";

/** Investor sign up intake: records the lead, then opens the account form set to investor (free). */
export function InvestorStartForm() {
  const f = investorStart.fields;
  const [sectors, setSectors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(s: string) {
    setSectors((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const details: Record<string, string | string[]> = {};
    const type = String(fd.get("investor_type") ?? "");
    const check = String(fd.get("check_size") ?? "");
    if (type) details.investor_type = type;
    if (check) details.check_size = check;
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
        <label className="text-[13px] font-medium text-site-navy">Work email<input name="email" type="email" required autoComplete="email" className={inputCls} placeholder="name@fund.com" /></label>
        <label className="text-[13px] font-medium text-site-navy">Firm<input name="firm" autoComplete="organization" className={inputCls} /></label>
        <label className="text-[13px] font-medium text-site-navy">Website<input name="website" inputMode="url" className={inputCls} placeholder="fund.com" /></label>
        <label className="text-[13px] font-medium text-site-navy">{f.investorType.label}
          <select name="investor_type" className={inputCls} defaultValue="">
            <option value="">Select…</option>
            {f.investorType.options.map((o) => (<option key={o} value={o}>{o}</option>))}
          </select>
        </label>
        <label className="text-[13px] font-medium text-site-navy">{f.checkSize.label}
          <select name="check_size" className={inputCls} defaultValue="">
            <option value="">Select…</option>
            {f.checkSize.options.map((o) => (<option key={o} value={o}>{o}</option>))}
          </select>
        </label>
      </div>

      <fieldset className="mt-5">
        <legend className="text-[13px] font-medium text-site-navy">{f.sectors.label}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {f.sectors.options.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggle(s)}
              aria-pressed={sectors.includes(s)}
              className={`rounded-full border px-3 py-1 text-[12.5px] transition-colors ${sectors.includes(s) ? "border-site-blue bg-site-blue text-white" : "border-site-line bg-white text-site-ink hover:border-site-blue-hi"}`}
            >
              {s}
            </button>
          ))}
        </div>
      </fieldset>

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
