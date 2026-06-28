"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import {
  ONBOARDING_STEPS,
  type OnboardingStepId,
  getNextOnboardingStep,
} from "@/lib/onboarding/progress";
import type { FounderOnboardingProgress } from "@/lib/onboarding/progress";
import type { Company, DocumentRecord } from "@/lib/supabase/types";
import { FormField } from "@/components/ui/FormField";
import { useFormValidation, type ZodFlatErrors } from "@/hooks/useFormValidation";

const companyProfileSchema = z.object({
  company_name: z.string().min(2),
  website: z.string().url().optional().or(z.literal("")),
  industry: z.string().min(2),
  country: z.string().min(2),
  business_description: z.string().min(20),
  founder_goals: z.string().min(10),
});

const fundingInfoSchema = z.object({
  revenue_stage: z.string().min(2),
  funding_amount: z.coerce.number().positive(),
  use_of_funds: z.string().min(10),
});

type Props = Readonly<{
  company: Company;
  documents: DocumentRecord[];
  initialProgress: FounderOnboardingProgress;
}>;

function stepIndex(stepId: OnboardingStepId) {
  return ONBOARDING_STEPS.findIndex((step) => step.id === stepId);
}

export function FounderOnboardingWizard({ company, documents, initialProgress }: Props) {
  const router = useRouter();
  const { getError, inputCls, validate, setApiErrors, clearError } = useFormValidation();

  const [activeStep, setActiveStep] = useState<OnboardingStepId>(initialProgress.currentStep);
  const [progress, setProgress] = useState(initialProgress);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [companyName, setCompanyName] = useState(company.company_name ?? "");
  const [website, setWebsite] = useState(company.website ?? "");
  const [industry, setIndustry] = useState(company.industry ?? "");
  const [country, setCountry] = useState(company.country ?? "");
  const [state, setState] = useState(company.state ?? "");
  const [description, setDescription] = useState(company.business_description ?? "");
  const [founderGoals, setFounderGoals] = useState(company.founder_goals ?? "");
  const [fundingAmount, setFundingAmount] = useState(company.funding_amount?.toString() ?? "");
  const [revenueStage, setRevenueStage] = useState(company.revenue_stage ?? "");
  const [useOfFunds, setUseOfFunds] = useState(company.use_of_funds ?? "");

  const activeMeta = ONBOARDING_STEPS.find((step) => step.id === activeStep) ?? ONBOARDING_STEPS[0];
  const activeIndex = stepIndex(activeStep);

  const encouragement = useMemo(() => {
    if (progress.isComplete) {
      return "Onboarding complete. Your profile is positioned for stronger investor visibility.";
    }
    if (progress.percent >= 60) {
      return "You are close to institutional readiness. Complete remaining steps to improve investor visibility.";
    }
    return "Complete your profile to unlock stronger investor visibility and improve readiness during your trial.";
  }, [progress.isComplete, progress.percent]);

  async function saveStep(step: OnboardingStepId, advance = true) {
    setIsSaving(true);
    setMessage(null);

    // Client-side validation before the fetch
    if (step === "company_profile") {
      const ok = validate(companyProfileSchema, {
        company_name: companyName.trim(),
        website: website.trim(),
        industry: industry.trim(),
        country: country.trim(),
        business_description: description.trim(),
        founder_goals: founderGoals.trim(),
      });
      if (!ok) {
        setIsSaving(false);
        return;
      }
    }

    if (step === "funding_information") {
      const ok = validate(fundingInfoSchema, {
        revenue_stage: revenueStage.trim(),
        funding_amount: fundingAmount,
        use_of_funds: useOfFunds.trim(),
      });
      if (!ok) {
        setIsSaving(false);
        return;
      }
    }

    const nextStep = advance ? getNextOnboardingStep(step) ?? step : step;

    const payload: Record<string, unknown> = { step, advanceToStep: nextStep };

    if (step === "company_profile") {
      payload.company_name = companyName.trim();
      payload.website = website.trim();
      payload.industry = industry.trim();
      payload.country = country.trim();
      payload.state = state.trim();
      payload.business_description = description.trim();
      payload.founder_goals = founderGoals.trim();
    }

    if (step === "funding_information") {
      payload.funding_amount = Number(fundingAmount);
      payload.revenue_stage = revenueStage.trim();
      payload.use_of_funds = useOfFunds.trim();
    }

    const response = await fetch("/api/founder/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = (await response.json().catch(() => null)) as {
      error?: string;
      details?: ZodFlatErrors;
      progress?: FounderOnboardingProgress;
    } | null;

    setIsSaving(false);

    if (!response.ok) {
      if (body?.details) {
        setApiErrors(body.details);
      } else {
        setMessage({ type: "error", text: body?.error ?? "Unable to save this step." });
      }
      return;
    }

    if (body?.progress) {
      setProgress(body.progress);
    }

    setMessage({ type: "success", text: "Progress saved." });

    if (advance && getNextOnboardingStep(step)) {
      setActiveStep(getNextOnboardingStep(step)!);
    }

    router.refresh();
  }

  const BASE_INPUT = "rounded-xl border px-4 py-3 font-normal w-full";

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5">
        <p className="text-sm font-semibold text-indigo-900">Investor readiness journey</p>
        <p className="mt-2 text-sm leading-6 text-indigo-800">{encouragement}</p>
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-indigo-900">
            <span>Onboarding progress</span>
            <span>{progress.percent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-indigo-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 transition-all"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {ONBOARDING_STEPS.map((step, index) => {
          const complete = progress.steps[step.id].completed;
          const active = step.id === activeStep;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => setActiveStep(step.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? "bg-slate-950 text-white"
                  : complete
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {index + 1}. {step.title}
            </button>
          );
        })}
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Step {activeIndex + 1} of {ONBOARDING_STEPS.length}
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{activeMeta.title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{activeMeta.description}</p>

        {activeStep === "company_profile" ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <FormField label="Company name" error={getError("company_name")} required className="md:col-span-2">
              <input
                className={`${BASE_INPUT} ${inputCls("company_name")}`}
                value={companyName}
                onChange={(e) => { setCompanyName(e.target.value); clearError("company_name"); }}
              />
            </FormField>

            <FormField label="Website" error={getError("website")} hint="Include https:// — e.g. https://example.com">
              <input
                className={`${BASE_INPUT} ${inputCls("website")}`}
                value={website}
                onChange={(e) => { setWebsite(e.target.value); clearError("website"); }}
                placeholder="https://example.com"
              />
            </FormField>

            <FormField label="Industry / sector" error={getError("industry")} required>
              <input
                className={`${BASE_INPUT} ${inputCls("industry")}`}
                value={industry}
                onChange={(e) => { setIndustry(e.target.value); clearError("industry"); }}
              />
            </FormField>

            <FormField label="Headquarters country" error={getError("country")} required>
              <input
                className={`${BASE_INPUT} ${inputCls("country")}`}
                value={country}
                onChange={(e) => { setCountry(e.target.value); clearError("country"); }}
              />
            </FormField>

            <FormField label="State / region" error={getError("state")}>
              <input
                className={`${BASE_INPUT} ${inputCls("state")}`}
                value={state}
                onChange={(e) => { setState(e.target.value); clearError("state"); }}
              />
            </FormField>

            <FormField label="Company description" error={getError("business_description")} required hint="Min 20 characters" className="md:col-span-2">
              <textarea
                className={`${BASE_INPUT} ${inputCls("business_description")}`}
                rows={4}
                value={description}
                onChange={(e) => { setDescription(e.target.value); clearError("business_description"); }}
              />
            </FormField>

            <FormField label="Founder goals & objectives" error={getError("founder_goals")} required hint="What are you raising capital for? What milestones will this funding unlock?" className="md:col-span-2">
              <textarea
                className={`${BASE_INPUT} ${inputCls("founder_goals")}`}
                rows={4}
                value={founderGoals}
                onChange={(e) => { setFounderGoals(e.target.value); clearError("founder_goals"); }}
              />
            </FormField>
          </div>
        ) : null}

        {activeStep === "funding_information" ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <FormField label="Funding stage" error={getError("revenue_stage")} required>
              <input
                className={`${BASE_INPUT} ${inputCls("revenue_stage")}`}
                value={revenueStage}
                onChange={(e) => { setRevenueStage(e.target.value); clearError("revenue_stage"); }}
                placeholder="Seed, Series A..."
              />
            </FormField>

            <FormField label="Target raise amount (USD)" error={getError("funding_amount")} required>
              <input
                className={`${BASE_INPUT} ${inputCls("funding_amount")}`}
                type="number"
                min={1}
                value={fundingAmount}
                onChange={(e) => { setFundingAmount(e.target.value); clearError("funding_amount"); }}
              />
            </FormField>

            <FormField label="Use of funds" error={getError("use_of_funds")} required hint="Min 10 characters" className="md:col-span-2">
              <textarea
                className={`${BASE_INPUT} ${inputCls("use_of_funds")}`}
                rows={4}
                value={useOfFunds}
                onChange={(e) => { setUseOfFunds(e.target.value); clearError("use_of_funds"); }}
              />
            </FormField>
          </div>
        ) : null}

        {activeStep === "documents_uploaded" ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-slate-600">
              {progress.pitchDeckUploaded
                ? "Pitch deck detected. Upload additional diligence files to strengthen readiness."
                : "Upload your pitch deck to continue building investor confidence."}
            </p>
            <ul className="space-y-2 text-sm text-slate-700">
              {documents.length > 0 ? (
                documents.map((document) => (
                  <li key={document.id} className="flex justify-between rounded-xl border border-slate-200 px-4 py-3">
                    <span>{document.file_name ?? document.document_type}</span>
                    <span className="text-xs text-slate-500">{document.status ?? "uploaded"}</span>
                  </li>
                ))
              ) : (
                <li className="rounded-xl border border-dashed border-slate-300 px-4 py-3 text-slate-500">
                  No documents uploaded yet.
                </li>
              )}
            </ul>
            <Link
              href="/founder/documents"
              className="inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
            >
              Go to document uploads
            </Link>
          </div>
        ) : null}

        {activeStep === "readiness_generated" ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-slate-600">
              {progress.diligenceReportExists
                ? "A diligence report exists for your company. Review readiness recommendations and improve your score."
                : "Generate or review diligence insights to understand gaps before investor conversations."}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/founder/readiness"
                className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
              >
                Improve your readiness
              </Link>
              <Link
                href="/founder/report"
                className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700"
              >
                View diligence report
              </Link>
            </div>
          </div>
        ) : null}

        {activeStep === "investor_readiness_review" ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-slate-600">
              Submit your company for admin review when your profile and documents are ready. This improves marketplace
              visibility and institutional investor confidence.
            </p>
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Review status: <strong>{company.review_status ?? company.status ?? "draft"}</strong>
            </p>
            <p className="text-sm text-slate-600">
              Complete your profile to unlock stronger investor visibility. iCapOS preserves your onboarding data
              even after trial expiration.
            </p>
          </div>
        ) : null}

        {message ? (
          <p
            className={`mt-6 rounded-xl p-3 text-sm ${
              message.type === "success" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
            }`}
          >
            {message.text}
          </p>
        ) : null}

        <div className="mt-8 flex flex-wrap justify-between gap-3">
          <button
            type="button"
            className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 disabled:opacity-50"
            disabled={activeIndex === 0 || isSaving}
            onClick={() => setActiveStep(ONBOARDING_STEPS[Math.max(0, activeIndex - 1)].id)}
          >
            Back
          </button>
          <div className="flex flex-wrap gap-3">
            {activeStep === "company_profile" ||
            activeStep === "funding_information" ||
            activeStep === "investor_readiness_review" ? (
              <button
                type="button"
                className="rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                disabled={isSaving}
                onClick={() => void saveStep(activeStep, true)}
              >
                {isSaving
                  ? "Saving..."
                  : activeStep === "investor_readiness_review"
                    ? "Submit for review & finish"
                    : "Save & continue"}
              </button>
            ) : (
              <button
                type="button"
                className="rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                disabled={isSaving}
                onClick={() => void saveStep(activeStep, true)}
              >
                {isSaving ? "Saving..." : "Continue"}
              </button>
            )}
            <button
              type="button"
              className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 disabled:opacity-60"
              disabled={isSaving}
              onClick={() => void saveStep(activeStep, false)}
            >
              Save step
            </button>
          </div>
        </div>
      </section>

      {progress.isComplete ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
          <p className="font-semibold">Onboarding complete</p>
          <p className="mt-2">Head to your dashboard to track readiness, documents, and investor engagement.</p>
          <Link
            href="/founder/dashboard"
            className="mt-4 inline-flex rounded-full bg-emerald-800 px-5 py-3 text-sm font-semibold text-white"
          >
            Open founder dashboard
          </Link>
        </div>
      ) : null}
    </div>
  );
}
