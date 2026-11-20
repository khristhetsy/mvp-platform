"use client";

import { useState } from "react";
import { AGREEMENT_TERMS } from "@/lib/billing/premium-agreement-core";

function Field({ id, label, value, onChange, multiline }: Readonly<{ id: string; label: string; value: string; onChange: (v: string) => void; multiline?: boolean }>) {
  const cls = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900";
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[12px] text-slate-500">{label}</label>
      {multiline ? (
        <textarea id={id} rows={3} value={value} maxLength={400} onChange={(e) => onChange(e.target.value)} className={cls} />
      ) : (
        <input id={id} value={value} maxLength={200} onChange={(e) => onChange(e.target.value)} className={cls} />
      )}
    </div>
  );
}

/** Agreement step of an admin sent Premium link: details, review the PDF, accept, then card checkout. */
export function PremiumAgreementLinkForm({ token, email, name, company }: Readonly<{ token: string; email: string; name: string | null; company: string | null }>) {
  const [agr, setAgr] = useState({ companyName: company ?? "", companyAddress: "", acceptedName: name ?? "", acceptedTitle: "" });
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const complete = Object.values(agr).every((v) => v.trim().length > 0);
  const payload = { ...agr, companyEmail: email };

  async function review() {
    if (!complete || reviewing) return;
    setReviewing(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/guest-agreement-preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "We could not prepare the agreement.");
      window.open(URL.createObjectURL(await res.blob()), "_blank", "noopener");
    } catch (e) {
      setError(e instanceof Error ? e.message : "We could not prepare the agreement.");
    }
    setReviewing(false);
  }

  async function accept() {
    if (!complete || !agree || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/premium-agreement/link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, agreement: payload, agree }) });
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      setError(data?.error ?? "Something went wrong. Please try again.");
    } catch {
      setError("Network error. Please try again.");
    }
    setBusy(false);
  }

  return (
    <div className="space-y-3">
      <p className="text-[13px] leading-5 text-slate-500">Check the details, review the agreement, then accept it. You then go on to secure card checkout. Notices go to {email}.</p>
      <div className="overflow-hidden rounded-lg border border-slate-200">
        {AGREEMENT_TERMS.map((t, i) => (
          <div key={t.label} className={`flex justify-between gap-3 px-3 py-2 text-[13px] ${i ? "border-t border-slate-200" : ""}`}>
            <span className="text-slate-500">{t.label}</span>
            <span className="text-right text-slate-900">{t.value}</span>
          </div>
        ))}
      </div>
      <Field id="pl-company" label="Company legal name" value={agr.companyName} onChange={(v) => setAgr({ ...agr, companyName: v })} />
      <Field id="pl-address" label="Company address" value={agr.companyAddress} onChange={(v) => setAgr({ ...agr, companyAddress: v })} multiline />
      <Field id="pl-name" label="Your name" value={agr.acceptedName} onChange={(v) => setAgr({ ...agr, acceptedName: v })} />
      <Field id="pl-title" label="Your title" value={agr.acceptedTitle} onChange={(v) => setAgr({ ...agr, acceptedTitle: v })} />
      <button type="button" onClick={review} disabled={!complete || reviewing} className="text-[13px] font-medium text-blue-600 underline disabled:cursor-not-allowed disabled:opacity-50">
        {reviewing ? "Preparing the agreement…" : "Review the agreement"}
      </button>
      <label className="flex gap-2.5 text-[13px] leading-5 text-slate-900">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4" />
        <span>I am authorized to accept this agreement for <strong>{agr.companyName || "my company"}</strong> and I agree to the Services Agreement. Fees are non refundable once services begin.</span>
      </label>
      {error ? <p className="text-[13px] text-red-600" role="alert">{error}</p> : null}
      <button type="button" onClick={accept} disabled={!complete || !agree || busy} className="w-full rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">
        {busy ? "Opening secure checkout…" : "Accept and pay $1,500/mo"}
      </button>
    </div>
  );
}
