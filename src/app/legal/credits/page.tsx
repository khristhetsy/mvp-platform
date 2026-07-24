import Link from "next/link";
import { CounselReviewBanner } from "@/components/legal/CounselReviewBanner";

export const metadata = {
  title: "iCFO Points — Program Rules & Terms · iCapOS",
  robots: { index: false },
};

export default function PointsTermsPage() {
  const effective = "[DRAFT — pending counsel review]";

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="mb-10">
          <Link href="/" className="text-sm font-semibold text-[var(--navy)] hover:underline">
            ← Back to iCapOS
          </Link>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-950">iCFO Points — Program Rules &amp; Terms</h1>
          <p className="mt-2 text-sm text-slate-500">Effective date: {effective}</p>
        </div>

        <CounselReviewBanner />

        <div className="prose prose-slate max-w-none text-sm leading-7 text-slate-700">
          <h2 className="mt-8 text-base font-semibold text-slate-900">1. What iCFO Points are</h2>
          <p>
            iCFO Points (&ldquo;Points&rdquo;) are a loyalty and engagement reward earned by participating in iCFO
            events and community activities, and redeemable for eligible iCFO products and services described below.
            Points are an internal rewards unit. <strong>They are not money, currency, legal tender, a stored-value
            instrument, a gift card, a security, or a deposit. Points have no cash value and are never redeemable for
            cash.</strong>
          </p>

          <h2 className="mt-6 text-base font-semibold text-slate-900">2. No cash value</h2>
          <p>
            Points have no cash value and cannot be exchanged, redeemed, or refunded for cash; cannot be sold,
            transferred, assigned, gifted, pooled across accounts, or used as collateral; and confer no ownership,
            equity, or financial claim in iCFO, any issuer, or any offering. Points are not insured by any government
            agency and are not a bank product.
          </p>

          <h2 className="mt-6 text-base font-semibold text-slate-900">3. Eligibility</h2>
          <p>
            Points are available to registered iCFO users in good standing who accept these terms. One rewards balance
            per verified account. We may exclude users, roles, or jurisdictions where the program is restricted.
          </p>

          <h2 className="mt-6 text-base font-semibold text-slate-900">4. How Points are earned</h2>
          <p>
            Points are awarded for community and educational participation — for example: registering for an event,
            watching a session, applying to present, being approved to present, opting into networking, accepting a
            connection, or completing a mission. Point values are set by iCFO and may change. Points are{" "}
            <strong>not</strong> awarded for making, referring, or facilitating any investment or securities-related
            activity. We may set caps, require verification, and reverse Points awarded in error or through abuse.
          </p>

          <h2 className="mt-6 text-base font-semibold text-slate-900">5. How Points are redeemed</h2>
          <p>
            Points may be redeemed only within the iCFO network, for a defined menu of eligible services set by iCFO.
            Redemption value is expressed as Points per service, not as a dollar amount.{" "}
            <strong>Points may not be redeemed toward, or used to offset,</strong> the purchase of any security;
            investment, subscription, carry, or deal fees; SPV or fund costs; cash or cash-equivalents; or any amount
            owed in connection with an actual or prospective investment.
          </p>

          <h2 className="mt-6 text-base font-semibold text-slate-900">6. Carrying your balance</h2>
          <p>
            Users may carry their Point balance across events and view it in their account. Your balance reflects
            Points earned minus Points redeemed, reversed, expired, or forfeited. iCFO&rsquo;s records are final absent
            manifest error.
          </p>

          <h2 className="mt-6 text-base font-semibold text-slate-900">7. Expiration and forfeiture</h2>
          <p>
            Points expire [12] months after they are earned, or after [12] months of account inactivity, whichever
            comes first. Unredeemed Points are forfeited without compensation upon expiration, account closure, or
            termination of the program. We may cancel Points obtained through error, fraud, abuse, or violation of
            these terms.
          </p>

          <h2 className="mt-6 text-base font-semibold text-slate-900">8. Non-transferability</h2>
          <p>
            Points are personal to the earning account. They may not be transferred, pooled, inherited, or moved on
            death, dissolution, or bankruptcy. Any attempted transfer is void.
          </p>

          <h2 className="mt-6 text-base font-semibold text-slate-900">9. Taxes</h2>
          <p>
            You are solely responsible for any taxes arising from earning or redeeming Points. Where required, iCFO may
            report the value of rewards and request tax information before redemption.
          </p>

          <h2 className="mt-6 text-base font-semibold text-slate-900">10. Not an offer of securities; no investment inducement</h2>
          <p>
            The Points program is an engagement and education loyalty program. It is <strong>not</strong> an offer,
            solicitation, inducement, or recommendation to buy, sell, or hold any security, and Points are not
            consideration for, or contingent on, any investment. Education and community — not an offer of securities.
          </p>

          <h2 className="mt-6 text-base font-semibold text-slate-900">11. Changes and termination</h2>
          <p>
            iCFO may modify, suspend, or discontinue the program, catalog, earning actions, Point values, or these
            terms at any time, with or without notice. Continued participation constitutes acceptance. On termination,
            unredeemed Points are forfeited without compensation, subject to applicable law.
          </p>

          <h2 className="mt-6 text-base font-semibold text-slate-900">12. Limitation of liability</h2>
          <p>
            To the maximum extent permitted by law, iCFO is not liable for any loss related to Points, including lost,
            expired, forfeited, or mis-awarded Points, or program changes. Points are provided &ldquo;as is.&rdquo;
          </p>

          <h2 className="mt-6 text-base font-semibold text-slate-900">13. Governing law</h2>
          <p>
            These terms are governed by the laws of the State of [Delaware], without regard to conflict-of-law rules,
            and are subject to the dispute-resolution provisions of the iCapOS Terms of Service.
          </p>

          <h2 className="mt-6 text-base font-semibold text-slate-900">14. Contact</h2>
          <p>
            Questions about the program: iCFO Capital Global, Inc. —{" "}
            <a href="mailto:info@myicfos.com" className="text-[var(--navy)] underline">info@myicfos.com</a> · (619) 956-9114.
          </p>
        </div>

        <div className="mt-12 border-t border-slate-200 pt-8 text-xs text-slate-400">
          <p>
            iCapOS · icapos.com ·{" "}
            <Link href="/terms" className="hover:underline">Terms of Service</Link> ·{" "}
            <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
