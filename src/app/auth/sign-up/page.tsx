import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { AuthForm } from "@/components/AuthForm";

export default function SignUpPage() {
  return (
    <AppShell role="FOUNDER">
      <section className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Founder access</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">Create your founder profile</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Supabase creates a linked profile after signup. Founder is the default role unless investor is selected.
        </p>
        <Suspense fallback={<p className="mt-8 text-sm text-slate-500">Loading signup...</p>}>
          <AuthForm mode="sign-up" />
        </Suspense>
      </section>
    </AppShell>
  );
}
