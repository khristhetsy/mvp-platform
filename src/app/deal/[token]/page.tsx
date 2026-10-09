import type { Metadata } from "next";
import Link from "next/link";
import { openDealNotice } from "@/lib/listing/deal-notices";
import { DealOptInButton } from "./DealOptInButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "A diligence complete deal | iCapOS",
  robots: { index: false, follow: false },
};

const DISCLAIMER =
  "iCFO Capital does not solicit securities and is not an investment adviser. Content is for educational purposes only.";

function Shell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-[#F4F6FA] text-[#16223F]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center px-4 py-4 sm:px-6">
          <Link href="/" className="text-lg font-bold tracking-tight text-[#0A1A40]">
            iCapOS
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">{children}</main>
      <footer className="mx-auto max-w-2xl px-4 pb-10 text-xs leading-5 text-slate-500 sm:px-6">
        <p>{DISCLAIMER}</p>
        <p className="mt-1">
          <Link href="/privacy" className="font-medium text-[#1A6CE4] hover:underline">Privacy</Link>
        </p>
      </footer>
    </div>
  );
}

export default async function DealNoticePage({ params }: Readonly<{ params: Promise<{ token: string }> }>) {
  const { token } = await params;
  const opened = await openDealNotice(token).catch(() => null);

  if (!opened) {
    return (
      <Shell>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-[#0A1A40]">We couldn&rsquo;t find this deal</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            The link may be incomplete or the listing is no longer available. Open the button in your email again, or reply to that email and we&rsquo;ll help.
          </p>
          <Link
            href="/auth/sign-in"
            className="mt-6 inline-flex rounded-lg bg-[#1A6CE4] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#2E78F5]"
          >
            Sign in to iCapOS
          </Link>
        </div>
      </Shell>
    );
  }

  const { summary: d } = opened;
  const meta = [d.industry, d.stage, d.location, d.raising].filter(Boolean).join(" · ");
  const description = d.description ? (d.description.length > 420 ? `${d.description.slice(0, 420).trimEnd()}…` : d.description) : null;

  return (
    <Shell>
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#185FA5]">Private Market</p>
      <h1 className="mt-2 text-2xl font-bold leading-tight tracking-tight text-[#0A1A40] sm:text-3xl">
        A company matching your investment focus completed AI due diligence on iCapOS.
      </h1>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-[#0A1A40]">{d.companyName}</h2>
            {meta ? <p className="mt-1 text-sm text-slate-500">{meta}</p> : null}
          </div>
          <div className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center">
            {d.crr == null ? (
              <span className="block text-xs font-medium leading-tight text-slate-500">Not yet<br />scored</span>
            ) : (
              <>
                <span className="block font-mono text-2xl font-semibold leading-none text-[#0A1A40]">{Math.round(d.crr)}</span>
                <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">CRR</span>
              </>
            )}
          </div>
        </div>
        {description ? <p className="mt-4 text-sm leading-6 text-slate-600">{description}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Diligence complete</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">Founder attested</span>
        </div>
      </div>

      <div className="mt-6">
        <DealOptInButton token={token} />
      </div>

      <p className="mt-8 text-xs leading-5 text-slate-500">
        The Capital Readiness Rating (CRR) is shown as it is. Every diligence complete company is listed with its score, and you decide.
      </p>
    </Shell>
  );
}
