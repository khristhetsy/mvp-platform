"use client";
import { useTranslations } from "next-intl";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Landing page for Supabase email invites (staff/admin). The invite link returns
 * the session in the URL hash (#access_token=...&type=invite). The browser client
 * parses that hash into a session automatically; here we confirm the session, then
 * have the new user set a password before sending them into the admin workspace.
 */
export default function AcceptInvitePage() {
  const t = useTranslations("appPages");
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      const supabase = createClient();

      // The browser client auto-parses the hash; give it a beat, then read session.
      const { data: { session } } = await supabase.auth.getSession();

      if (!session && !hash.includes("access_token")) {
        setError("This invite link is invalid or has expired. Ask an admin to resend it.");
        setTimeout(() => router.push("/auth/sign-in"), 4000);
        return;
      }

      setEmail(session?.user?.email ?? null);
      setIsReady(true);
    };

    void init();
  }, [router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setIsLoading(true);
    const supabase = createClient();

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setIsLoading(false);
      return;
    }

    // Session is active and cookie-backed — go straight into the workspace.
    router.push("/admin/dashboard");
  }

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">{error ?? "Verifying your invite…"}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#534AB7]">iCapOS</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{t("set_your_password")}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {email ? `Finish setting up ${email}.` : "Finish setting up your account."} Choose a password to access your workspace.
          </p>
        </div>

        {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">New password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            disabled={isLoading}
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-slate-700">Confirm password</label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            disabled={isLoading}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-lg bg-[#534AB7] py-2.5 text-sm font-semibold text-white hover:bg-[#463da0] disabled:opacity-50"
        >
          {isLoading ? "Setting password…" : "Set password & continue"}
        </button>
      </form>
    </div>
  );
}
