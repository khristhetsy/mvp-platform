"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import {
  SIGNUP_FOUNDER_PLANS,
  SIGNUP_INVESTOR_PLAN,
  type PlanType,
} from "@/lib/subscriptions/plans";
import { FormField } from "@/components/ui/FormField";
import { useFormValidation } from "@/hooks/useFormValidation";

type SignupRole = "founder" | "investor";

function signUpDestinationByRole(role: SignupRole, privateBetaMode: boolean) {
  if (role === "founder") return "/founder/onboarding";
  return privateBetaMode ? "/investor/onboarding" : "/investor/dashboard";
}

function defaultPlanForRole(role: SignupRole): PlanType {
  return role === "founder" ? "founder_trial" : "investor_free";
}

function PlanCard({
  plan,
  selected,
  onSelect,
}: Readonly<{
  plan: (typeof SIGNUP_FOUNDER_PLANS)[number] | typeof SIGNUP_INVESTOR_PLAN;
  selected: boolean;
  onSelect: () => void;
}>) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative w-full rounded-2xl border p-4 text-left transition ${
        selected
          ? "border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-600/20"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      {plan.badge ? (
        <span className="absolute right-3 top-3 rounded-full bg-indigo-600 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
          {plan.badge}
        </span>
      ) : null}
      <div className="flex items-start justify-between gap-3 pr-16">
        <div>
          <p className="text-sm font-semibold text-slate-950">{plan.title}</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {plan.priceLabel}
            {plan.priceSubtext ? (
              <span className="text-sm font-normal text-slate-500">{plan.priceSubtext}</span>
            ) : null}
          </p>
        </div>
        <span
          className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
            selected ? "border-indigo-600 bg-indigo-600" : "border-slate-300 bg-white"
          }`}
          aria-hidden
        >
          {selected ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
        </span>
      </div>
      <ul className="mt-3 space-y-1.5">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-xs leading-5 text-slate-600">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-indigo-500" />
            {feature}
          </li>
        ))}
      </ul>
      {plan.paidPlan ? (
        <p className="mt-3 text-[11px] leading-4 text-slate-500">
          Billing activation required before paid features unlock.
        </p>
      ) : null}
    </button>
  );
}

const signUpSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

const BASE_INPUT =
  "rounded-xl border px-4 py-3 font-normal text-slate-900 outline-none transition";

export function SignUpForm({ privateBetaMode = false }: Readonly<{ privateBetaMode?: boolean }>) {
  const t = useTranslations("sharedCmp");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getError, inputCls, validate, clearError } = useFormValidation();

  const [role, setRole] = useState<SignupRole>("founder");
  const [selectedPlan, setSelectedPlan] = useState<PlanType>("founder_trial");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- prefill signup form from URL params */
    const requestedRole = searchParams.get("role");
    if (requestedRole === "founder" || requestedRole === "investor") {
      setRole(requestedRole);
      setSelectedPlan(defaultPlanForRole(requestedRole));
    }
    const prefillEmail = searchParams.get("email");
    if (prefillEmail) setEmail(prefillEmail);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [searchParams]);

  function handleRoleChange(nextRole: SignupRole) {
    setRole(nextRole);
    setSelectedPlan(defaultPlanForRole(nextRole));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setApiError(null);

    if (!validate(signUpSchema, { fullName, email, password })) return;

    setIsLoading(true);
    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          full_name: fullName,
          role,
          requested_plan: selectedPlan,
        },
      },
    });

    setIsLoading(false);

    if (signUpError) {
      setApiError(signUpError.message);
      return;
    }

    router.push(signUpDestinationByRole(role, privateBetaMode));
    router.refresh();
  }

  const submitLabel = role === "founder" ? "Create founder account" : "Create investor account";

  return (
    <div className="flex w-full max-w-xl flex-col">
      <div className="mb-8 lg:hidden">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-sm font-bold text-white shadow-sm">
            C
          </span>
          <span className="text-lg font-semibold tracking-tight text-slate-950">iCapOS</span>
        </Link>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">{t("create_account")}</p>
        {privateBetaMode ? (
          <span className="mt-3 inline-flex rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-800">
            Private Beta
          </span>
        ) : null}
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{t("join_icapos")}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {privateBetaMode
            ? role === "investor"
              ? "Create your investor account. Access is granted after iCapOS staff reviews and approves your profile."
              : "Create your founder account and complete onboarding. iCapOS staff may review your company before marketplace publication."
            : "Choose your workspace, select a plan, and create your secure account. No credit card required to start."}
        </p>
      </div>

      <div className="mt-8">
        <p className="text-sm font-medium text-slate-700">{t("i_am_a")}</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {(["founder", "investor"] as const).map((option) => {
            const active = role === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => handleRoleChange(option)}
                className={`rounded-xl border px-4 py-3 text-sm font-semibold capitalize transition ${
                  active
                    ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-8">
        <p className="text-sm font-medium text-slate-700">
          {role === "founder" ? "Founder plan" : "Investor account"}
        </p>
        <div className={`mt-3 grid gap-3 ${role === "founder" ? "md:grid-cols-1" : ""}`}>
          {role === "founder" ? (
            SIGNUP_FOUNDER_PLANS.map((plan) => (
              <PlanCard
                key={plan.planType}
                plan={plan}
                selected={selectedPlan === plan.planType}
                onSelect={() => setSelectedPlan(plan.planType)}
              />
            ))
          ) : (
            <PlanCard
              plan={SIGNUP_INVESTOR_PLAN}
              selected={selectedPlan === SIGNUP_INVESTOR_PLAN.planType}
              onSelect={() => setSelectedPlan(SIGNUP_INVESTOR_PLAN.planType)}
            />
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 grid gap-4">
        <input type="hidden" name="role" value={role} />
        <input type="hidden" name="requested_plan" value={selectedPlan} />

        <FormField label={t("full_name")} error={getError("fullName")} required>
          <input
            className={`${BASE_INPUT} ${inputCls("fullName")}`}
            placeholder={t("jane_founder")}
            value={fullName}
            onChange={(e) => { setFullName(e.target.value); clearError("fullName"); }}
          />
        </FormField>

        <FormField label={t("work_email")} error={getError("email")} required>
          <input
            className={`${BASE_INPUT} ${inputCls("email")}`}
            placeholder={t("you_company_com")}
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); clearError("email"); }}
          />
        </FormField>

        <FormField label={t("password")} error={getError("password")} required hint="Minimum 8 characters">
          <input
            className={`${BASE_INPUT} ${inputCls("password")}`}
            placeholder="••••••••"
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); clearError("password"); }}
          />
        </FormField>

        {apiError ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{apiError}</p> : null}

        <button
          type="submit"
          className="rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:from-indigo-500 hover:to-violet-500 disabled:opacity-60"
          disabled={isLoading}
        >
          {isLoading ? "Please wait..." : submitLabel}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link href="/auth/sign-in" className="font-semibold text-indigo-600 hover:text-indigo-500">
          Sign in
        </Link>
      </p>

      <p className="mt-4 text-center text-xs leading-5 text-slate-500">
        By creating an account, you agree to our{" "}
        <Link href="/terms" className="underline underline-offset-2 hover:text-slate-700">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-slate-700">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
