import Link from "next/link";
import { MarketingFooter } from "@/components/MarketingFooter";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { CapitalOSLogo } from "@/components/CapitalOSLogo";

export default function LoginPage() {
  return (
    <MarketingShell>
      <section className="px-4 py-8 lg:px-8 lg:py-10">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <CapitalOSLogo height={52} tagline priority className="mb-6" />
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">Platform access</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[var(--navy)] md:text-5xl">
              Sign in to continue your capital readiness workflow.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
              Founder, investor, admin, and analyst access is role-based. Supabase Auth powers production authentication.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[var(--shadow-panel)]">
            <div className="rounded-lg border border-slate-100 bg-[var(--surface-sunken)] p-5">
              <h2 className="text-xl font-semibold text-[var(--navy)]">Choose access path</h2>
              <div className="mt-5 grid gap-2.5">
                <Link
                  href="/auth/sign-in"
                  className="cap-btn-secondary rounded-lg p-3.5 text-sm font-semibold"
                >
                  Sign in with Supabase Auth
                </Link>
                <Link
                  href="/auth/sign-up"
                  className="cap-btn-secondary rounded-lg p-3.5 text-sm font-semibold"
                >
                  Create founder or investor account
                </Link>
                <Link href="/submit-company" className="cap-btn-primary rounded-lg p-3.5 text-sm font-semibold">
                  Submit company profile
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
      <MarketingFooter />
    </MarketingShell>
  );
}
