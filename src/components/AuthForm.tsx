"use client";

import { useState } from "react";
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

  return (
    <form onSubmit={handleSubmit} className="mt-8 grid gap-4">
      {mode === "sign-up" ? (
        <>
          <FormField label="Full name" error={getError("fullName")} required>
            <input
              className={`${BASE_INPUT} ${inputCls("fullName")}`}
              placeholder="Jane Founder"
              value={fullName}
              onChange={(e) => { setFullName(e.target.value); clearError("fullName"); }}
            />
          </FormField>
          <div className="grid gap-1.5">
            <span className="text-sm font-medium text-slate-700">I am a</span>
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

      <FormField label="Work email" error={getError("email")} required>
        <input
          className={`${BASE_INPUT} ${inputCls("email")}`}
          placeholder="you@company.com"
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); clearError("email"); }}
        />
      </FormField>

      <FormField label="Password" error={getError("password")} required hint={mode === "sign-up" ? "Minimum 8 characters" : undefined}>
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
  );
}
