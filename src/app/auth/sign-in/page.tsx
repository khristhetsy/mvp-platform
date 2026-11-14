import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";
import { EmailRequestForm } from "@/components/auth/EmailRequestForm";
import { getTranslations } from "next-intl/server";
import { MarketingShell } from "@/components/marketing/MarketingShell";

export default async function SignInPage() {
  const t = await getTranslations("appPages");
  return (
    <MarketingShell>
      <section className="mx-auto max-w-xl px-4 py-12 lg:px-6">
        <div className="rounded-xl border border-slate-200/80 bg-white p-8 shadow-[var(--shadow-panel)]">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{t("platform_access")}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{t("login")}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Enter your credentials to access your workspace. You&apos;ll be redirected based on your account role.
          </p>
          <Suspense fallback={<p className="mt-8 text-sm text-slate-500">{t("loading")}</p>}>
            <AuthForm mode="sign-in" />
          </Suspense>
        </div>
        <div className="mt-6 rounded-xl border border-dashed border-[#2E78F5] bg-[#E7F0FE] p-6">
          <h2 className="text-base font-semibold text-slate-950">Paid but have no login yet?</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">Enter the email you paid with and we will send your private login link again.</p>
          <div className="mt-4">
            <EmailRequestForm
              endpoint="/api/start/resend-login"
              label="Email used for payment"
              button="Send my login link"
              sentMessage="If that email has a paid plan waiting for a login, the link is on its way. Check your inbox and spam folder."
            />
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
