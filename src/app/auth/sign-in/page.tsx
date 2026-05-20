import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { AuthForm } from "@/components/AuthForm";

export default function SignInPage() {
  return (
    <AppShell role="INVESTOR">
      <section className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Supabase authentication</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">Sign in</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Sign in with Supabase Auth. Middleware will redirect you to the right dashboard based on your profile role.
        </p>
        <Suspense fallback={<p className="mt-8 text-sm text-slate-500">Loading sign in...</p>}>
          <AuthForm mode="sign-in" />
        </Suspense>
      </section>
    </AppShell>
  );
}
