"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { listingInputSchema } from "@/lib/marketplace/validation";
import { createListing } from "./actions";

const MAX_DESC = 280;

export function ListingForm({ defaultCompanyName }: Readonly<{ defaultCompanyName: string }>) {
  const router = useRouter();
  const [desc, setDesc] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    const toNum = (v: FormDataEntryValue | null) => {
      const s = String(v ?? "").replace(/[^0-9.]/g, "");
      return s ? Number(s) : null;
    };
    const input = {
      companyName: String(formData.get("companyName") ?? ""),
      briefDescription: String(formData.get("briefDescription") ?? ""),
      industry: String(formData.get("industry") ?? ""),
      location: String(formData.get("location") ?? ""),
      securityType: String(formData.get("securityType") ?? ""),
      offeringAmountMin: toNum(formData.get("offeringAmountMin")),
      offeringAmountMax: toNum(formData.get("offeringAmountMax")),
      portalName: String(formData.get("portalName") ?? ""),
      portalUrl: String(formData.get("portalUrl") ?? ""),
    };
    const parsed = listingInputSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the form.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await createListing(parsed.data);
      if (res.ok) {
        setDone(true);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
        <p className="text-sm font-semibold text-emerald-800">Listing submitted for review</p>
        <p className="mt-1 text-sm text-emerald-700">
          Our team reviews every listing before it goes live. You&apos;ll be notified once it&apos;s published to the marketplace.
        </p>
      </div>
    );
  }

  const label = "block text-xs font-semibold text-slate-600";
  const field = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

  return (
    <form action={onSubmit} className="grid gap-4">
      <div>
        <label className={label} htmlFor="companyName">Company name</label>
        <input id="companyName" name="companyName" defaultValue={defaultCompanyName} required className={field} />
      </div>

      <div>
        <label className={label} htmlFor="briefDescription">Brief description (tombstone — facts only)</label>
        <textarea
          id="briefDescription"
          name="briefDescription"
          required
          rows={3}
          maxLength={MAX_DESC}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          className={field}
          placeholder="One or two neutral sentences about what the company does."
        />
        <p className="mt-1 text-[11px] text-slate-400">{desc.length}/{MAX_DESC} · No performance claims, returns, or guarantees.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="industry">Industry</label>
          <input id="industry" name="industry" className={field} placeholder="e.g. Climate Data" />
        </div>
        <div>
          <label className={label} htmlFor="location">Location</label>
          <input id="location" name="location" className={field} placeholder="e.g. Austin, TX" />
        </div>
        <div>
          <label className={label} htmlFor="securityType">Security type</label>
          <input id="securityType" name="securityType" className={field} placeholder="e.g. Crowd SAFE" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={label} htmlFor="offeringAmountMin">Raise min ($)</label>
            <input id="offeringAmountMin" name="offeringAmountMin" inputMode="numeric" className={field} placeholder="250000" />
          </div>
          <div>
            <label className={label} htmlFor="offeringAmountMax">Raise max ($)</label>
            <input id="offeringAmountMax" name="offeringAmountMax" inputMode="numeric" className={field} placeholder="1200000" />
          </div>
        </div>
        <div>
          <label className={label} htmlFor="portalName">Portal name</label>
          <input id="portalName" name="portalName" required className={field} placeholder="e.g. Wefunder" />
        </div>
        <div>
          <label className={label} htmlFor="portalUrl">Portal URL (https)</label>
          <input id="portalUrl" name="portalUrl" type="url" required className={field} placeholder="https://wefunder.com/yourcompany" />
        </div>
      </div>

      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-lg bg-[#1A6CE4] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          {pending ? "Submitting…" : "Submit for review"}
        </button>
        <span className="text-xs text-slate-400">Every listing is reviewed before it appears publicly.</span>
      </div>
    </form>
  );
}
