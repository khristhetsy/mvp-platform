"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CONTACT_PREFERENCES, INVESTOR_TYPES, type InvestorProfileRecord } from "@/lib/investor/types";

function joinList(values: string[] | null | undefined) {
  return (values ?? []).join(", ");
}

export function InvestorOnboardingWizard({
  investorProfile,
  profileName,
}: Readonly<{
  investorProfile: InvestorProfileRecord;
  profileName: string;
}>) {
  const router = useRouter();
  const [investorType, setInvestorType] = useState(investorProfile.investor_type ?? "");
  const [firmName, setFirmName] = useState(investorProfile.firm_name ?? "");
  const [checkSizeMin, setCheckSizeMin] = useState(
    investorProfile.check_size_min != null ? String(investorProfile.check_size_min) : "",
  );
  const [checkSizeMax, setCheckSizeMax] = useState(
    investorProfile.check_size_max != null ? String(investorProfile.check_size_max) : "",
  );
  const [preferredSectors, setPreferredSectors] = useState(joinList(investorProfile.preferred_sectors));
  const [preferredGeographies, setPreferredGeographies] = useState(joinList(investorProfile.preferred_geographies));
  const [preferredStages, setPreferredStages] = useState(joinList(investorProfile.preferred_stages));
  const [accreditedStatus, setAccreditedStatus] = useState(investorProfile.accredited_status);
  const [investmentThesis, setInvestmentThesis] = useState(investorProfile.investment_thesis ?? "");
  const [contactPreference, setContactPreference] = useState(investorProfile.contact_preference ?? "platform");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const isPending = investorProfile.approval_status === "submitted";
  const isApproved = investorProfile.approval_status === "approved";

  async function save(submit: boolean) {
    setIsSaving(true);
    setMessage(null);

    const response = await fetch("/api/investor/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        investor_type: investorType,
        firm_name: firmName || undefined,
        check_size_min: checkSizeMin ? Number(checkSizeMin) : undefined,
        check_size_max: checkSizeMax ? Number(checkSizeMax) : undefined,
        preferred_sectors: preferredSectors,
        preferred_geographies: preferredGeographies,
        preferred_stages: preferredStages,
        accredited_status: accreditedStatus,
        investment_thesis: investmentThesis,
        contact_preference: contactPreference,
        submit,
      }),
    });

    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    setIsSaving(false);

    if (!response.ok) {
      setMessage({ type: "error", text: body?.error ?? "Unable to save investor onboarding." });
      return;
    }

    setMessage({
      type: "success",
      text: submit
        ? "Profile submitted for admin approval. You will be notified when reviewed."
        : "Draft saved.",
    });
    router.refresh();
  }

  return (
    <form
      className="space-y-8"
      onSubmit={(event) => {
        event.preventDefault();
        void save(true);
      }}
    >
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        Welcome, <span className="font-semibold text-slate-900">{profileName}</span>. Complete your institutional
        investor profile for admin review. This is a self-attestation workflow — no third-party KYC integration in this
        phase.
      </div>

      {investorProfile.admin_feedback ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="font-semibold">Admin feedback:</span> {investorProfile.admin_feedback}
        </p>
      ) : null}

      {message ? (
        <p
          className={`rounded-xl px-4 py-3 text-sm ${
            message.type === "success" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </p>
      ) : null}

      <fieldset disabled={isPending || isApproved} className="grid gap-6 disabled:opacity-70">
        <div className="grid gap-2">
          <label className="text-sm font-medium text-slate-800">Investor type</label>
          <select
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
            value={investorType}
            onChange={(event) => setInvestorType(event.target.value)}
            required
          >
            <option value="">Select type</option>
            {INVESTOR_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium text-slate-800">Individual / firm name</label>
          <input
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
            value={firmName}
            onChange={(event) => setFirmName(event.target.value)}
            placeholder="Fund name or individual investing entity"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <label className="text-sm font-medium text-slate-800">Check size min (USD)</label>
            <input
              type="number"
              min={0}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
              value={checkSizeMin}
              onChange={(event) => setCheckSizeMin(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium text-slate-800">Check size max (USD)</label>
            <input
              type="number"
              min={0}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
              value={checkSizeMax}
              onChange={(event) => setCheckSizeMax(event.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium text-slate-800">Preferred sectors (comma-separated)</label>
          <input
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
            value={preferredSectors}
            onChange={(event) => setPreferredSectors(event.target.value)}
            required
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium text-slate-800">Preferred geographies (comma-separated)</label>
          <input
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
            value={preferredGeographies}
            onChange={(event) => setPreferredGeographies(event.target.value)}
            required
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium text-slate-800">Investment stage preference (comma-separated)</label>
          <input
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
            value={preferredStages}
            onChange={(event) => setPreferredStages(event.target.value)}
            placeholder="Pre-seed, Seed, Series A"
            required
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium text-slate-800">Investment thesis</label>
          <textarea
            className="min-h-28 rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
            value={investmentThesis}
            onChange={(event) => setInvestmentThesis(event.target.value)}
            required
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium text-slate-800">Contact preference</label>
          <select
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
            value={contactPreference}
            onChange={(event) => setContactPreference(event.target.value)}
            required
          >
            {CONTACT_PREFERENCES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          <input
            type="checkbox"
            className="mt-1"
            checked={accreditedStatus}
            onChange={(event) => setAccreditedStatus(event.target.checked)}
            required
          />
          <span>
            I self-attest that I am an accredited investor (or equivalent qualified investor in my jurisdiction) and
            understand this is not a third-party verification.
          </span>
        </label>
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-800 disabled:opacity-50"
          disabled={isSaving || isPending || isApproved}
          onClick={() => void save(false)}
        >
          Save draft
        </button>
        <button
          type="submit"
          className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          disabled={isSaving || isPending || isApproved}
        >
          Submit for approval
        </button>
      </div>
    </form>
  );
}
