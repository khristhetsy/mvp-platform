import Link from "next/link";
import { MarketingShell } from "@/components/marketing/MarketingShell";

const NEXT = "%2Fprivate-market";

function Lock({ size = 22 }: Readonly<{ size?: number }>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * What a signed out visitor sees at /private-market. No company data is loaded
 * here: the blurred blocks behind the card are decoration only.
 */
export function PrivateMarketGate() {
  return (
    <MarketingShell>
      <section className="relative min-h-[680px] overflow-hidden bg-site-paper px-6 py-16">
        <div className="pointer-events-none absolute inset-0 mx-auto max-w-6xl select-none px-6 pt-10 opacity-70 blur-[7px]" aria-hidden="true">
          <div className="h-32 rounded-2xl border border-site-line bg-white" />
          <div className="mt-5 grid grid-cols-3 gap-5">
            <div className="h-72 rounded-2xl border border-site-line bg-white" />
            <div className="h-72 rounded-2xl border border-site-line bg-gradient-to-b from-[#f3f7ff] to-white" />
            <div className="h-72 rounded-2xl border border-site-line bg-white" />
          </div>
          <div className="mt-5 h-16 rounded-2xl bg-site-navy" />
        </div>
        <div className="relative mx-auto max-w-md rounded-2xl border border-site-line bg-white p-8 shadow-xl">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-site-blue/30 bg-site-blue-pale text-site-blue">
            <Lock />
          </span>
          <p className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-site-blue/30 bg-site-blue-pale px-2.5 py-0.5 font-site-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] text-site-blue">
            <Lock size={12} /> Members only
          </p>
          <h1 className="mt-3 font-site-display text-2xl font-extrabold tracking-tight text-site-navy">Sign in to see the Private Market</h1>
          <p className="mt-2 text-sm leading-6 text-site-muted">
            The Private Market lists companies approved by iCapOS. It is available to signed in founders, investors and iCFO staff.
          </p>
          <Link
            href={`/auth/sign-in?next=${NEXT}`}
            className="mt-6 flex w-full items-center justify-center rounded-lg bg-site-blue px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi"
          >
            Sign in
          </Link>
          <p className="mt-4 text-center text-sm text-site-muted">
            New to iCapOS?{" "}
            <Link href="/start" className="font-semibold text-site-blue hover:text-site-blue-hi">
              Get started
            </Link>
          </p>
          <p className="mt-5 border-t border-site-line pt-4 font-site-mono text-[11px] leading-relaxed text-site-muted">
            After you sign in you come straight back to the Private Market. Listings show summaries only, never documents.
          </p>
        </div>
      </section>
    </MarketingShell>
  );
}
