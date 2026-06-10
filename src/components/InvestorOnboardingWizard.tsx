"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { CONTACT_PREFERENCES, INVESTOR_TYPES, type InvestorProfileRecord } from "@/lib/investor/types";
import { FormField } from "@/components/ui/FormField";
import { useFormValidation, type ZodFlatErrors } from "@/hooks/useFormValidation";

const investorProfileSchema = z.object({
  investor_type: z.string().min(1),
  preferred_sectors: z.string().min(2),
  preferred_geographies: z.string().min(2),
  preferred_stages: z.string().min(2),
  investment_thesis: z.string().min(20).max(5000),
  accredited_status: z.literal(true, {
    errorMap: () => ({ message: "You must confirm accredited investor status to submit." }),
  }),
});

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
  const { getError, inputCls, validate, setApiErrors, clearError } = useFormValidation();

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

  const BASE_INPUT = "rounded-xl border px-4 py-2.5 text-sm w-full";

  async function save(submit: boolean) {
    setIsSaving(true);
    setMessage(null);

    if (submit) {
      const ok = validate(investorProfileSchema, {
        investor_type: investorType,
        preferred_sectors: preferredSectors,
        preferred_geographies: preferredGeographies,
        preferred_stages: preferredStages,
        investment_thesis: investmentThesis,
        accredited_status: accreditedStatus,
      });
      if (!ok) {
        setIsSaving(false);
        return;
      }
    }

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

    const body = (await response.json().catch(() => null)) as {
      error?: string;
      details?: ZodFlatErrors;
    } | null;

    setIsSaving(false);

    if (!response.ok) {
      if (body?.details) {
        setApiErrors(body.details);
      } else {
        setMessage({ type: "error", text: body?.error ?? "Unable to save investor onboarding." });
      }
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
        <FormField label="Investor type" error={getError("investor_type")} required>
          <select
            className={`${BASE_INPUT} ${inputCls("investor_type")}`}
            value={investorType}
            onChange={(e) => { setInvestorType(e.target.value); clearError("investor_type"); }}
          >
            <option value="">Select type</option>
            {INVESTOR_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Individual / firm name" error={getError("firm_name")}>
          <input
            className={`${BASE_INPUT} ${inputCls("firm_name")}`}
            value={firmName}
            onChange={(e) => { setFirmName(e.target.value); clearError("firm_name"); }}
            placeholder="Fund name or individual investing entity"
          />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Check size min (USD)" error={getError("check_size_min")}>
            <input
              type="number"
              min={0}
              className={`${BASE_INPUT} ${inputCls("check_size_min")}`}
              value={checkSizeMin}
              onChange={(e) => { setCheckSizeMin(e.target.value); clearError("check_size_min"); }}
            />
          </FormField>
          <FormField label="Check size max (USD)" error={getError("check_size_max")}>
            <input
              type="number"
              min={0}
              className={`${BASE_INPUT} ${inputCls("check_size_max")}`}
              value={checkSizeMax}
              onChange={(e) => { setCheckSizeMax(e.target.value); clearError("check_size_max"); }}
            />
          </FormField>
        </div>

        <FormField label="Preferred sectors" error={getError("preferred_sectors")} required hint="Comma-separated — e.g. FinTech, SaaS, HealthTech">
          <input
            className={`${BASE_INPUT} ${inputCls("preferred_sectors")}`}
            value={preferredSectors}
            onChange={(e) => { setPreferredSectors(e.target.value); clearError("preferred_sectors"); }}
          />
        </FormField>

        <FormField label="Preferred geographies" error={getError("preferred_geographies")} required hint="Comma-separated — e.g. US, Europe, LATAM">
          <input
            className={`${BASE_INPUT} ${inputCls("preferred_geographies")}`}
            value={preferredGeographies}
            onChange={(e) => { setPreferredGeographies(e.target.value); clearError("preferred_geographies"); }}
          />
        </FormField>

        <FormField label="Investment stage preference" error={getError("preferred_stages")} required hint="Comma-separated — e.g. Pre-seed, Seed, Series A">
          <input
            className={`${BASE_INPUT} ${inputCls("preferred_stages")}`}
            value={preferredStages}
            onChange={(e) => { setPreferredStages(e.target.value); clearError("preferred_stages"); }}
            placeholder="Pre-seed, Seed, Series A"
          />
        </FormField>

        <FormField label="Investment thesis" error={getError("investment_thesis")} required hint="Min 20 characters, max 5000">
          <textarea
            className={`min-h-28 ${BASE_INPUT} ${inputCls("investment_thesis")}`}
            value={investmentThesis}
            onChange={(e) => { setInvestmentThesis(e.target.value); clearError("investment_thesis"); }}
          />
        </FormField>

        <FormField label="Contact preference" error={getError("contact_preference")} required>
          <select
            className={`${BASE_INPUT} ${inputCls("contact_preference")}`}
            value={contactPreference}
            onChange={(e) => { setContactPreference(e.target.value); clearError("contact_preference"); }}
          >
            {CONTACT_PREFERENCES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FormField>

        <div className="grid gap-1.5">
          <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-1"
              checked={accreditedStatus}
              onChange={(e) => { setAccreditedStatus(e.target.checked); clearError("accredited_status"); }}
            />
            <span>
              I self-attest that I am an accredited investor (or equivalent qualified investor in my jurisdiction) and
              understand this is not a third-party verification.
            </span>
          </label>
          {getError("accredited_status") ? (
            <p className="flex items-center gap-1.5 text-xs text-red-600" role="alert">
              {getError("accredited_status")}
            </p>
          ) : null}
        </div>
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
