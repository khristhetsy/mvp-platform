import Link from "next/link";
import { Suspense } from "react";
import { SignUpForm } from "@/components/SignUpForm";
import { isPrivateBetaMode } from "@/lib/env/private-beta";

const trustPoints = [
  "Role-based workspaces for founders and investors",
  "Private document storage with signed URL access",
  "Server-enforced entitlements and subscription controls",
];

export default function SignUpPage() {
  const privateBetaMode = isPrivateBetaMode();

  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-slate-950 lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(79,70,229,0.35),transparent_55%),radial-gradient(circle_at_bottom_right,rgba(124,58,237,0.25),transparent_50%)]" />
        <div className="relative flex flex-1 flex-col justify-between p-10 xl:p-14">
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white shadow-lg shadow-indigo-900/30">
                C
              </span>
              <span className="text-xl font-semibold tracking-tight text-white">CapitalOS</span>
            </Link>
            <p className="mt-10 text-xs font-semibold uppercase tracking-[0.24em] text-indigo-300">
              Venture readiness platform
            </p>
            <h2 className="mt-4 max-w-md text-4xl font-semibold leading-tight tracking-tight text-white">
              Build, diligence, and raise with one connected workspace.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-7 text-slate-300">
              CapitalOS brings together AI diligence, document readiness, investor CRM, and capital raise tools in a
              secure founder and investor platform.
            </p>
            <ul className="mt-8 space-y-3">
              {trustPoints.map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm text-slate-200">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                  {point}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-200">
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
                  <path
                    d="M12 3l7 4v5c0 4.4-3 8.5-7 9-4-.5-7-4.6-7-9V7l7-4z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                  <path d="M9.5 12.5l1.8 1.8 3.7-3.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </span>
              <div>
                <p className="text-sm font-semibold text-white">Secure & trusted</p>
                <p className="text-xs text-slate-300">Enterprise-grade auth, RLS, and role-checked access</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              Your account is protected by Supabase Auth. Subscription entitlements are enforced on the server — client
              plan selection never grants paid access automatically.
            </p>
          </div>
        </div>
      </aside>

      <main className="flex min-h-screen flex-col justify-center px-6 py-10 sm:px-10 lg:px-12 xl:px-16">
        <Suspense fallback={<p className="text-sm text-slate-500">Loading signup...</p>}>
          <SignUpForm privateBetaMode={privateBetaMode} />
        </Suspense>
      </main>
    </div>
  );
}
