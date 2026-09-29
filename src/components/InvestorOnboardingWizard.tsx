"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { z } from "zod";
import { CONTACT_PREFERENCES, INVESTOR_TYPES, type InvestorProfileRecord } from "@/lib/investor/types";
import { FormField } from "@/components/ui/FormField";
import { useFormValidation, type ZodFlatErrors } from "@/hooks/useFormValidation";
import { useVocabulary } from "@/lib/vocabulary/provider";
import { resolveSlug, type VocabularyOption } from "@/lib/vocabulary/lists";
import {
  DEFAULT_ENGINE_WEIGHTS,
  joinBandList,
  splitBandList,
  type EngineWeights,
} from "@/lib/matching/investor-company-matching";
import { investorMeter } from "@/lib/matching/matchable-points";
import { ChipMultiSelect, MatchablePointsMeter, ReadByPersonBadge } from "@/components/matching/MatchablePointsMeter";

const investorProfileSchema = z.object({
  investor_type: z.string().min(1),
  preferred_sectors: z.string().min(2),
  preferred_geographies: z.string().min(2),
  preferred_stages: z.string().min(2),
  investment_thesis: z.string().min(20).max(5000),
  accredited_status: z.literal(true, {
    error: () => ({ message: "You must confirm accredited investor status to submit." }),
  }),
});

function joinList(values: string[] | null | undefined) {
  return (values ?? []).join(", ");
}

/**
 * Stored values for a picker. Lists are stored as labels (the matcher compares
 * text), so a saved value that names an option, by slug or label, maps to that
 * option's label. A value that names no option is kept as it is, so an answer
 * typed before the pickers existed is shown and saved back, never dropped.
 */
function toLabels(stored: readonly string[] | null | undefined, options: VocabularyOption[]): string[] {
  return (stored ?? [])
    .map((v) => {
      const slug = resolveSlug(options, v);
      return slug ? (options.find((o) => o.slug === slug)?.label ?? v) : v;
    })
    .filter((v) => v.trim());
}

/** Picker options: the offered list, plus any held value that is not on it. */
function pickerOptions(options: VocabularyOption[], held: string[]) {
  const labels = options.map((o) => o.label);
  return [
    ...options.map((o) => ({ value: o.label, label: o.label })),
    ...held.filter((h) => !labels.includes(h)).map((h) => ({ value: h, label: h })),
  ];
}

export function InvestorOnboardingWizard({
  investorProfile,
  profileName,
  matchWeights = DEFAULT_ENGINE_WEIGHTS,
}: Readonly<{
  investorProfile: InvestorProfileRecord;
  profileName: string;
  /** The matching engine's weights (admin match settings), for the meter. */
  matchWeights?: EngineWeights;
}>) {
  const t = useTranslations("sharedCmp");
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
  // Every field the matcher reads is a selection from the shared option lists
  // (Admin, Profile and fields). The thesis stays free text, read by a person.
  const industryList = useVocabulary("industry").options;
  const geographyList = useVocabulary("geography").options;
  const stageList = useVocabulary("funding_stage").options;
  const capitalList = useVocabulary("capital_type").options;
  const arrList = useVocabulary("arr_band").options;
  const mrrList = useVocabulary("mrr_band").options;

  const [preferredArrBands, setPreferredArrBands] = useState<string[]>(() =>
    toLabels(splitBandList(investorProfile.preferred_arr_range), arrList),
  );
  const [preferredMrrBands, setPreferredMrrBands] = useState<string[]>(() =>
    toLabels(splitBandList(investorProfile.preferred_mrr_range), mrrList),
  );
  const [preferredSectors, setPreferredSectors] = useState<string[]>(() =>
    toLabels(investorProfile.preferred_sectors, industryList),
  );
  const [preferredGeographies, setPreferredGeographies] = useState<string[]>(() =>
    toLabels(investorProfile.preferred_geographies, geographyList),
  );
  const [preferredStages, setPreferredStages] = useState<string[]>(() =>
    toLabels(investorProfile.preferred_stages, stageList),
  );
  const [capitalTypes, setCapitalTypes] = useState<string[]>(() =>
    toLabels(investorProfile.capital_types ?? [], capitalList),
  );
  const [accreditedStatus, setAccreditedStatus] = useState(investorProfile.accredited_status);
  const [investmentThesis, setInvestmentThesis] = useState(investorProfile.investment_thesis ?? "");
  const [contactPreference, setContactPreference] = useState(investorProfile.contact_preference ?? "platform");
  const [addressLine1, setAddressLine1] = useState(investorProfile.address_line1 ?? "");
  const [addressCity, setAddressCity] = useState(investorProfile.address_city ?? "");
  const [addressState, setAddressState] = useState(investorProfile.address_state ?? "");
  const [addressPostal, setAddressPostal] = useState(investorProfile.address_postal_code ?? "");
  const [addressCountry, setAddressCountry] = useState(investorProfile.address_country ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const isPending = investorProfile.approval_status === "submitted";
  const isApproved = investorProfile.approval_status === "approved";

  const BASE_INPUT = "rounded-xl border px-4 py-2.5 text-sm w-full";
  const locked = isPending || isApproved;

  const meter = useMemo(
    () =>
      investorMeter(
        {
          sectors: preferredSectors,
          stages: preferredStages,
          checkSizeMin,
          checkSizeMax,
          geographies: preferredGeographies,
          investorType,
          capitalTypes,
          arrBands: preferredArrBands,
          mrrBands: preferredMrrBands,
        },
        matchWeights,
      ),
    [preferredSectors, preferredStages, checkSizeMin, checkSizeMax, preferredGeographies, investorType, capitalTypes, preferredArrBands, preferredMrrBands, matchWeights],
  );

  async function save(submit: boolean) {
    setIsSaving(true);
    setMessage(null);

    if (submit) {
      const ok = validate(investorProfileSchema, {
        investor_type: investorType,
        preferred_sectors: joinList(preferredSectors),
        preferred_geographies: joinList(preferredGeographies),
        preferred_stages: joinList(preferredStages),
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
        preferred_arr_range: joinBandList(preferredArrBands) || undefined,
        preferred_mrr_range: joinBandList(preferredMrrBands) || undefined,
        capital_types: joinList(capitalTypes),
        preferred_sectors: joinList(preferredSectors),
        preferred_geographies: joinList(preferredGeographies),
        preferred_stages: joinList(preferredStages),
        accredited_status: accreditedStatus,
        investment_thesis: investmentThesis,
        contact_preference: contactPreference,
        address_line1: addressLine1 || undefined,
        address_city: addressCity || undefined,
        address_state: addressState || undefined,
        address_postal_code: addressPostal || undefined,
        address_country: addressCountry || undefined,
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
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
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
          <span className="font-semibold">{t("admin_feedback_2")}</span> {investorProfile.admin_feedback}
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
        <FormField label={t("investor_type")} error={getError("investor_type")} required>
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

        <FormField label={t("individual_firm_name")} error={getError("firm_name")}>
          <input
            className={`${BASE_INPUT} ${inputCls("firm_name")}`}
            value={firmName}
            onChange={(e) => { setFirmName(e.target.value); clearError("firm_name"); }}
            placeholder={t("fund_name_or_individual_investing_entity")}
          />
        </FormField>

        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">{t("address")}</p>
            <p className="text-xs text-slate-500">Helps founders assess geographic fit and supports verification. Country is used for matching.</p>
          </div>
          <FormField label={t("street_address")} error={getError("address_line1")}>
            <input
              className={`${BASE_INPUT} ${inputCls("address_line1")}`}
              value={addressLine1}
              onChange={(e) => { setAddressLine1(e.target.value); clearError("address_line1"); }}
              placeholder={t("123_market_st_suite_400")}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t("city")} error={getError("address_city")}>
              <input
                className={`${BASE_INPUT} ${inputCls("address_city")}`}
                value={addressCity}
                onChange={(e) => { setAddressCity(e.target.value); clearError("address_city"); }}
              />
            </FormField>
            <FormField label={t("state_province")} error={getError("address_state")}>
              <input
                className={`${BASE_INPUT} ${inputCls("address_state")}`}
                value={addressState}
                onChange={(e) => { setAddressState(e.target.value); clearError("address_state"); }}
              />
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t("postal_code")} error={getError("address_postal_code")}>
              <input
                className={`${BASE_INPUT} ${inputCls("address_postal_code")}`}
                value={addressPostal}
                onChange={(e) => { setAddressPostal(e.target.value); clearError("address_postal_code"); }}
              />
            </FormField>
            <FormField label={t("country")} error={getError("address_country")} hint="Used for founder matching">
              <input
                className={`${BASE_INPUT} ${inputCls("address_country")}`}
                value={addressCountry}
                onChange={(e) => { setAddressCountry(e.target.value); clearError("address_country"); }}
                placeholder={t("united_states")}
              />
            </FormField>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t("check_size_min_usd")} error={getError("check_size_min")}>
            <input
              type="number"
              min={0}
              className={`${BASE_INPUT} ${inputCls("check_size_min")}`}
              value={checkSizeMin}
              onChange={(e) => { setCheckSizeMin(e.target.value); clearError("check_size_min"); }}
            />
          </FormField>
          <FormField label={t("check_size_max_usd")} error={getError("check_size_max")}>
            <input
              type="number"
              min={0}
              className={`${BASE_INPUT} ${inputCls("check_size_max")}`}
              value={checkSizeMax}
              onChange={(e) => { setCheckSizeMax(e.target.value); clearError("check_size_max"); }}
            />
          </FormField>
        </div>

        <FormField label={t("preferred_sectors")} error={getError("preferred_sectors")} required hint="Pick every industry you invest in.">
          <ChipMultiSelect
            ariaLabel={t("preferred_sectors")}
            options={pickerOptions(industryList, preferredSectors)}
            selected={preferredSectors}
            disabled={locked}
            onChange={(v) => { setPreferredSectors(v); clearError("preferred_sectors"); }}
          />
        </FormField>

        <FormField label={t("investment_stage_preference")} error={getError("preferred_stages")} required>
          <ChipMultiSelect
            ariaLabel={t("investment_stage_preference")}
            options={pickerOptions(stageList, preferredStages)}
            selected={preferredStages}
            disabled={locked}
            onChange={(v) => { setPreferredStages(v); clearError("preferred_stages"); }}
          />
        </FormField>

        <FormField label={t("preferred_geographies")} error={getError("preferred_geographies")} required>
          <ChipMultiSelect
            ariaLabel={t("preferred_geographies")}
            options={pickerOptions(geographyList, preferredGeographies)}
            selected={preferredGeographies}
            disabled={locked}
            onChange={(v) => { setPreferredGeographies(v); clearError("preferred_geographies"); }}
          />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Preferred ARR range" error={getError("preferred_arr_range")} hint="The same bands founders pick from. Pick all that apply.">
            <ChipMultiSelect
              ariaLabel="Preferred ARR range"
              options={pickerOptions(arrList, preferredArrBands)}
              selected={preferredArrBands}
              disabled={locked}
              onChange={(v) => { setPreferredArrBands(v); clearError("preferred_arr_range"); }}
            />
          </FormField>
          <FormField label="Preferred MRR range" error={getError("preferred_mrr_range")} hint="The same bands founders pick from. Pick all that apply.">
            <ChipMultiSelect
              ariaLabel="Preferred MRR range"
              options={pickerOptions(mrrList, preferredMrrBands)}
              selected={preferredMrrBands}
              disabled={locked}
              onChange={(v) => { setPreferredMrrBands(v); clearError("preferred_mrr_range"); }}
            />
          </FormField>
        </div>

        <FormField label="Capital type" error={getError("capital_types")} hint="What you offer. Matched against what founders are seeking.">
          <ChipMultiSelect
            ariaLabel="Capital type"
            options={pickerOptions(capitalList, capitalTypes)}
            selected={capitalTypes}
            disabled={locked}
            onChange={(v) => { setCapitalTypes(v); clearError("capital_types"); }}
          />
        </FormField>

        <FormField label={t("investment_thesis")} error={getError("investment_thesis")} required hint="Min 20 characters, max 5000">
          <div className="-mt-1 mb-1"><ReadByPersonBadge /></div>
          <textarea
            className={`min-h-28 ${BASE_INPUT} ${inputCls("investment_thesis")}`}
            value={investmentThesis}
            onChange={(e) => { setInvestmentThesis(e.target.value); clearError("investment_thesis"); }}
          />
        </FormField>

        <FormField label={t("contact_preference")} error={getError("contact_preference")} required>
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
      <MatchablePointsMeter meter={meter} className="lg:sticky lg:top-6" />
    </div>
  );
}
