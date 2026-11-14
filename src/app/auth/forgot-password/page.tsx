import Link from "next/link";
import { EmailRequestForm } from "@/components/auth/EmailRequestForm";
import { MarketingShell } from "@/components/marketing/MarketingShell";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <MarketingShell>
      <section className="mx-auto max-w-xl px-4 py-12 lg:px-6">
        <div className="rounded-xl border border-slate-200/80 bg-white p-8 shadow-[var(--shadow-panel)]">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Platform access</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Forgot password</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">Enter your email and we will send you a link to choose a new password.</p>
          <div className="mt-6">
            <EmailRequestForm
              endpoint="/api/auth/forgot-password"
              label="Email"
              button="Send reset link"
              sentMessage="If that email has an account, a reset link is on its way. Check your inbox and spam folder."
            />
          </div>
          <p className="mt-6 text-sm text-slate-600">
            <Link href="/auth/sign-in" className="font-semibold text-[#1A6CE4] hover:underline">Back to login</Link>
          </p>
        </div>
      </section>
    </MarketingShell>
  );
}
