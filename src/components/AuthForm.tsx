"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/supabase/types";

const dashboardByRole: Record<UserRole, string> = {
  founder: "/founder/dashboard",
  investor: "/investor/dashboard",
  admin: "/admin/dashboard",
  analyst: "/admin/dashboard",
};

export function AuthForm({ mode }: Readonly<{ mode: "sign-in" | "sign-up" }>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("founder");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
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
        setError(signUpError.message);
        return;
      }

      router.push(dashboardByRole[role]);
      router.refresh();
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setIsLoading(false);
      setError(signInError.message);
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setIsLoading(false);
      setError("Unable to verify the signed-in user.");
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
      setError("No profile was found for this account.");
      return;
    }

    const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : null;

    setIsLoading(false);
    router.push(safeNext || dashboardByRole[profile.role]);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 grid gap-4">
      {mode === "sign-up" ? (
        <>
          <input
            className="rounded-xl border border-slate-300 px-4 py-3"
            placeholder="Full name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
          />
          <select
            className="rounded-xl border border-slate-300 px-4 py-3"
            value={role}
            onChange={(event) => setRole(event.target.value as UserRole)}
          >
            <option value="founder">Founder</option>
            <option value="investor">Investor</option>
          </select>
        </>
      ) : null}
      <input
        className="rounded-xl border border-slate-300 px-4 py-3"
        placeholder="Work email"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />
      <input
        className="rounded-xl border border-slate-300 px-4 py-3"
        placeholder="Password"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
        minLength={8}
      />
      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <button className="rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white" disabled={isLoading}>
        {isLoading ? "Please wait..." : mode === "sign-up" ? "Create account" : "Sign in"}
      </button>
    </form>
  );
}
