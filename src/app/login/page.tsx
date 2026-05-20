import Link from "next/link";
import { MarketingFooter } from "@/components/MarketingFooter";
import { MarketingNav } from "@/components/MarketingNav";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-white text-slate-950">
      <MarketingNav />
      <section className="mx-auto grid max-w-7xl gap-10 px-6 py-16 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Platform access</p>
          <h1 className="mt-4 text-5xl font-semibold tracking-[-0.04em] md:text-6xl">
            Sign in to continue your capital readiness workflow.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            Founder, investor, admin, and analyst access is role-based. Supabase Auth powers production authentication.
          </p>
        </div>
        <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-5">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold text-slate-950">Choose access path</h2>
            <div className="mt-6 grid gap-3">
              <Link href="/auth/sign-in" className="rounded-2xl border border-slate-200 p-4 text-sm font-semibold text-slate-800">
                Sign in with Supabase Auth
              </Link>
              <Link href="/auth/sign-up" className="rounded-2xl border border-slate-200 p-4 text-sm font-semibold text-slate-800">
                Create founder or investor account
              </Link>
              <Link href="/submit-company" className="rounded-2xl bg-slate-950 p-4 text-sm font-semibold text-white">
                Submit company profile
              </Link>
            </div>
          </div>
        </div>
      </section>
      <MarketingFooter />
    </main>
  );
}
