"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/supabase/types";
import { FormField } from "@/components/ui/FormField";
import { useFormValidation } from "@/hooks/useFormValidation";

const signInDestinationByRole: Record<UserRole, string> = {
  founder: "/founder/dashboard",
  investor: "/investor/dashboard",
  admin: "/admin/dashboard",
  analyst: "/admin/dashboard",
};

const signUpDestinationByRole: Record<UserRole, string> = {
  founder: "/founder/onboarding",
  investor: "/investor/dashboard",
  admin: "/admin/dashboard",
  analyst: "/admin/dashboard",
};

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const signUpSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

const BASE_INPUT = "rounded-xl border px-4 py-3 w-full";

export function AuthForm({ mode }: Readonly<{ mode: "sign-in" | "sign-up" }>) {
  const t = useTranslations("sharedCmp");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getError, inputCls, validate, clearError } = useFormValidation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("founder");
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setApiError(null);

    const data = mode === "sign-up" ? { fullName, email, password } : { email, password };
    const schema = mode === "sign-up" ? signUpSchema : signInSchema;
    if (!validate(schema, data)) return;

    setIsLoading(true);
    const supabase = createClient();

    if (mode === "sign-up") {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: { full_name: fullName, role },
        },
      });

      setIsLoading(false);

      if (signUpError) {
        setApiError(signUpError.message);
        return;
      }

      router.push(signUpDestinationByRole[role]);
      router.refresh();
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setIsLoading(false);
      setApiError(signInError.message);
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setIsLoading(false);
      setApiError("Unable to verify the signed-in user.");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const next = searchParams.get("next");

    if (profileError || !profile) {
      await supabase.auth.signOut();
      setIsLoading(false);
      setApiError("No profile was found for this account.");
      return;
    }

    const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : null;

    setIsLoading(false);
    router.push(safeNext || signInDestinationByRole[profile.role]);
    router.refresh();
  }

  async function signInWithProvider(provider: "google" | "linkedin_oidc") {
    setApiError(null);
    setIsLoading(true);
    const supabase = createClient();
    const next = searchParams.get("next");
    const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : null;
    const redirectTo = `${window.location.origin}/auth/callback${safeNext ? `?next=${encodeURIComponent(safeNext)}` : ""}`;
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
    if (error) {
      setIsLoading(false);
      setApiError(error.message);
    }
    // On success the browser is redirected to the provider — nothing more to do here.
  }

  const oauthBtn = "flex items-center justify-center gap-2.5 rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60";

  return (
    <div className="mt-8">
      <div className="grid gap-2.5">
        <button type="button" onClick={() => signInWithProvider("google")} disabled={isLoading} className={oauthBtn}>
          <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.2 26.7 36 24 36c-5.3 0-9.7-3.1-11.3-7.6l-6.5 5C9.6 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C39.9 36.9 44 31 44 24c0-1.3-.1-2.3-.4-3.5z"/></svg>
          Continue with Google
        </button>
        <button type="button" onClick={() => signInWithProvider("linkedin_oidc")} disabled={isLoading} className={oauthBtn}>
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="#0A66C2" d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5V8h3v11zM6.5 6.7a1.7 1.7 0 110-3.4 1.7 1.7 0 010 3.4zM19 19h-3v-5.6c0-1.3-.5-2.2-1.7-2.2-.9 0-1.4.6-1.7 1.2-.1.2-.1.5-.1.8V19h-3V8h3v1.3c.4-.6 1.1-1.5 2.7-1.5 2 0 3.5 1.3 3.5 4.1V19z"/></svg>
          Continue with LinkedIn
        </button>
      </div>
      <div className="my-4 flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" />or<span className="h-px flex-1 bg-slate-200" /></div>
    <form onSubmit={handleSubmit} className="grid gap-4">
      {mode === "sign-up" ? (
        <>
          <FormField label={t("full_name")} error={getError("fullName")} required>
            <input
              className={`${BASE_INPUT} ${inputCls("fullName")}`}
              placeholder={t("jane_founder")}
              value={fullName}
              onChange={(e) => { setFullName(e.target.value); clearError("fullName"); }}
            />
          </FormField>
          <div className="grid gap-1.5">
            <span className="text-sm font-medium text-slate-700">{t("i_am_a")}</span>
            <select
              className={`${BASE_INPUT} border-slate-300 text-slate-950`}
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
            >
              <option value="founder">Founder</option>
              <option value="investor">Investor</option>
            </select>
          </div>
        </>
      ) : null}

      <FormField label={t("work_email")} error={getError("email")} required>
        <input
          className={`${BASE_INPUT} ${inputCls("email")}`}
          placeholder={t("you_company_com")}
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); clearError("email"); }}
        />
      </FormField>

      <FormField label={t("password")} error={getError("password")} required hint={mode === "sign-up" ? "Minimum 8 characters" : undefined}>
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
        className="rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
        disabled={isLoading}
      >
        {isLoading ? "Please wait..." : mode === "sign-up" ? "Create account" : "Login"}
      </button>
    </form>
    </div>
  );
}
