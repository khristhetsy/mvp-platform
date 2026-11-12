"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

/** Last step of pay first, account after: the plan is paid, the email is locked, they only choose a password. */
export function CreateLoginForm({ token, email }: Readonly<{ token: string | null; email: string }>) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exists, setExists] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/start/paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token ?? undefined, password }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; redirect?: string; error?: string; code?: string } | null;
      if (res.ok && data?.ok) {
        router.push(data.redirect ?? "/founder/onboarding");
        router.refresh();
        return;
      }
      setExists(data?.code === "exists" || data?.code === "claimed");
      setError(data?.error ?? "Something went wrong. Please try again.");
    } catch {
      setError("Network error. Please try again.");
    }
    setBusy(false);
  }

  const inputCls = "mt-1 w-full rounded-lg border border-site-line bg-white px-3 py-2.5 text-sm text-site-ink outline-none focus:border-site-blue-hi";
  return (
    <form onSubmit={onSubmit}>
      <label className="block text-[13px] font-medium text-site-navy">
        Email (from your payment)
        <input value={email} readOnly className={`${inputCls} bg-slate-100`} aria-readonly="true" />
      </label>
      <label className="mt-4 block text-[13px] font-medium text-site-navy">
        Create password
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputCls}
          placeholder="At least 8 characters"
        />
      </label>
      {error ? (
        <p className="mt-3 text-[13px] text-red-600" role="alert">
          {error}{" "}
          {exists ? <Link href="/auth/sign-in" className="font-medium underline">Sign in</Link> : null}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="mt-5 w-full rounded-lg bg-site-blue px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi disabled:opacity-60"
      >
        {busy ? "Creating your login…" : "Create my login and start onboarding"}
      </button>
      <p className="mt-3 text-center text-[12px] leading-5 text-site-muted">Your plan is already active, so onboarding opens as soon as your login is created.</p>
    </form>
  );
}
