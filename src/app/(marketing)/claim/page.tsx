import type { Metadata } from "next";
import Link from "next/link";
import { activePartner, leadForEmail, normalizePartnerCode, verifyClaimToken } from "@/lib/listing/claim";
import { ClaimForm } from "./ClaimForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Claim your free due diligence report | iCapOS",
  robots: { index: false, follow: false },
};

const SECURITY_ROWS = [
  "Encrypted in transit and at rest",
  "Documents stored in a private vault, never public",
  "Investors see your listing summary only. Documents stay private until you share them",
  "You control who sees what, and can turn off any share link",
  "We never sell your data",
  "Your report is yours to share with any investor",
];

const DISCLAIMER =
  "iCFO Capital does not solicit securities and is not an investment adviser. Content is for educational purposes only.";

export default async function ClaimPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ t?: string | string[]; ref?: string | string[] }> }>) {
  const sp = await searchParams;
  const token = typeof sp.t === "string" ? sp.t : null;
  const refRaw = typeof sp.ref === "string" ? sp.ref : null;

  const email = verifyClaimToken(token);
  const [lead, partner] = await Promise.all([
    email ? leadForEmail(email).catch(() => null) : Promise.resolve(null),
    activePartner(normalizePartnerCode(refRaw)).catch(() => null),
  ]);
  const company = lead?.company?.trim() || null;

  return (
    <section className="bg-site-paper px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-md bg-[#E7F5EC] px-3 py-1.5 text-[13px] font-bold text-[#1F6B3A]">
              FREE · No credit card required
            </span>
            {partner ? (
              <span className="inline-flex rounded-md bg-site-blue-pale px-3 py-1.5 text-[13px] font-semibold text-site-navy">
                Referred by {partner.partnerName}
              </span>
            ) : null}
          </div>
          <h1 className="mt-5 font-site-display text-3xl font-extrabold leading-tight tracking-tight text-site-navy sm:text-4xl">
            {company ? `Claim your free report for ${company}` : "Claim your free report"}
          </h1>
          <p className="mt-4 text-lg leading-8 text-site-muted">
            Full AI due diligence report and Capital Readiness Rating. One time, completely free.
          </p>

          <div className="mt-8 rounded-2xl border border-site-line bg-white p-6 sm:p-7">
            <ClaimForm verifiedEmail={email} claimToken={email ? token : null} partnerCode={partner?.code ?? null} />
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-site-line bg-white p-6">
            <h2 className="font-site-display text-lg font-bold text-site-navy">Your data is secure and safe</h2>
            <ul className="mt-4 space-y-3">
              {SECURITY_ROWS.map((row) => (
                <li key={row} className="flex items-start gap-2.5 text-sm leading-6 text-site-ink">
                  <svg viewBox="0 0 20 20" className="mt-1 h-4 w-4 shrink-0 text-[#1F6B3A]" fill="none" aria-hidden="true">
                    <path d="M4 10.5l3.5 3.5L16 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>{row}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-site-line bg-white p-6">
            <h2 className="font-site-display text-lg font-bold text-site-navy">Use your report with any investor</h2>
            <p className="mt-3 text-sm leading-6 text-site-muted">
              Your report is yours. Share it with any prospective investor, inside or outside our network, through a secure link or PDF, and see when they open it.
            </p>
          </div>

          <p className="text-xs leading-5 text-site-muted">
            {DISCLAIMER} Read our{" "}
            <Link href="/privacy" className="font-semibold text-site-blue hover:underline">
              privacy policy
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
