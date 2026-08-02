"use client";

import Link from "next/link";
import { useState } from "react";
import { start } from "@/content/start";

/**
 * Signup intake form (spec §3, §9-ish). Posts to /api/lead (service-role write),
 * then hands off to existing auth via the returned redirect — does not reimplement
 * auth. Keyboard-operable; the whole thing degrades to a normal form.
 */
export function StartForm() {
  const f = start.fields;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [choice, setChoice] = useState("rating_only");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get("name") ?? "").trim() || undefined,
      email: String(fd.get("email") ?? "").trim(),
      company: String(fd.get("company") ?? "").trim() || undefined,
      website: String(fd.get("website") ?? "").trim() || undefined,
      stage: String(fd.get("stage") ?? "") || undefined,
      raise_target: String(fd.get("raise_target") ?? "") || undefined,
      capital_structure: (String(fd.get("capital_structure") ?? "") || undefined) as
        | "reg_d" | "reg_cf" | "reg_a_plus" | "not_sure" | undefined,
      start_choice: choice as "rating_only" | "rating_plus_plan",
      source_page: "/start",
    };
    try {
      const res = await fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; redirect?: string; error?: string } | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "Something went wrong. Please try again.");
        setBusy(false);
        return;
      }
      window.location.href = data.redirect ?? "/auth/sign-up";
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
        <label className="text-[13px] font-medium text-site-navy">Work email<input name="email" type="email" required autoComplete="email" className={inputCls} placeholder="name@company.com" /></label>
        <label className="text-[13px] font-medium text-site-navy">Company<input name="company" autoComplete="organization" className={inputCls} /></label>
        <label className="text-[13px] font-medium text-site-navy">Website<input name="website" inputMode="url" className={inputCls} placeholder="company.com" /></label>
        <label className="text-[13px] font-medium text-site-navy">{f.stage.label}
          <select name="stage" className={inputCls} defaultValue="">{f.stage.options.map((o) => (<option key={o} value={o}>{o}</option>))}</select>
        </label>
        <label className="text-[13px] font-medium text-site-navy">{f.raise.label}
          <select name="raise_target" className={inputCls} defaultValue="">{f.raise.options.map((o) => (<option key={o} value={o}>{o}</option>))}</select>
        </label>
      </div>

      <label className="mt-4 block text-[13px] font-medium text-site-navy">{f.capital.label}
        <select name="capital_structure" className={inputCls} defaultValue="">{f.capital.options.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}</select>
      </label>

      <fieldset className="mt-5">
        <legend className="text-[13px] font-medium text-site-navy">{f.startWith.label}</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {f.startWith.options.map((o) => (
            <label key={o.value} className={`cursor-pointer rounded-xl border p-4 transition-colors ${choice === o.value ? "border-site-blue-hi bg-site-blue-pale/40" : "border-site-line bg-white"}`}>
              <input type="radio" name="start_choice" value={o.value} checked={choice === o.value} onChange={() => setChoice(o.value)} className="sr-only" />
              <div className="text-sm font-semibold text-site-navy">{o.label}</div>
              <div className="mt-0.5 text-[12px] text-site-muted">{o.sub}</div>
            </label>
          ))}
        </div>
      </fieldset>

      {error ? <p className="mt-4 text-[13px] text-red-600" role="alert">{error}</p> : null}

      <button type="submit" disabled={busy} className="mt-6 w-full rounded-lg bg-site-blue px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi disabled:opacity-60">
        {busy ? "Creating…" : start.submit}
      </button>
      <p className="mt-3 text-center text-[13px] text-site-muted">{start.signinPrompt} <Link href={start.signinCta.href} className="font-medium text-site-blue hover:text-site-blue-hi">{start.signinCta.label}</Link></p>
      <p className="mt-4 text-[11px] leading-5 text-site-muted/80">{start.terms}</p>
    </form>
  );
}
