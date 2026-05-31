import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";
import { MarketingShell } from "@/components/marketing/MarketingShell";

export default function SignInPage() {
  return (
    <MarketingShell>
      <section className="mx-auto max-w-xl px-4 py-12 lg:px-6">
        <div className="rounded-xl border border-slate-200/80 bg-white p-8 shadow-[var(--shadow-panel)]">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Platform access</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--navy)]">Sign in</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Sign in with Supabase Auth. Middleware will redirect you to the right dashboard based on your profile role.
          </p>
          <Suspense fallback={<p className="mt-8 text-sm text-slate-500">Loading sign in...</p>}>
            <AuthForm mode="sign-in" />
          </Suspense>
        </div>
      </section>
    </MarketingShell>
  );
}
