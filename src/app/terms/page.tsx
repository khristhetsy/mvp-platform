import Link from "next/link";
import { CounselReviewBanner } from "@/components/legal/CounselReviewBanner";

export const metadata = { title: "Terms of Service – iCapOS" };

export default function TermsPage() {
  const effective = "June 1, 2025";

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto max-w-3xl px-6 py-16">
        {/* Header */}
        <div className="mb-10">
          <Link href="/" className="text-sm font-semibold text-[var(--navy)] hover:underline">
            ← Back to iCapOS
          </Link>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-950">Terms of Service</h1>
          <p className="mt-2 text-sm text-slate-500">Effective date: {effective}</p>
        </div>

        <CounselReviewBanner />

        <div className="prose prose-slate max-w-none text-sm leading-7 text-slate-700">
          <p>
            By accessing or using iCapOS (&ldquo;the Platform&rdquo;), you agree to be bound by these Terms of
            Service. Please read them carefully.
          </p>

          <h2 className="mt-8 text-base font-semibold text-slate-900">1. Acceptance of Terms</h2>
          <p>
            These Terms constitute a legally binding agreement between you and iCapOS. If you do not agree to
            these Terms, you may not use the Platform.
          </p>

          <h2 className="mt-6 text-base font-semibold text-slate-900">2. Use of the Platform</h2>
          <p>
            You agree to use the Platform only for lawful purposes and in accordance with these Terms. You are
            responsible for maintaining the confidentiality of your account credentials and for all activity that
            occurs under your account.
          </p>

          <h2 className="mt-6 text-base font-semibold text-slate-900">3. Intellectual Property</h2>
          <p>
            All content, features, and functionality of the Platform are owned by iCapOS and are protected by
            applicable intellectual property laws. You may not reproduce, distribute, or create derivative works
            without our express written permission.
          </p>

          <h2 className="mt-6 text-base font-semibold text-slate-900">4. Disclaimer of Warranties</h2>
          <p>
            The Platform is provided &ldquo;as is&rdquo; without warranties of any kind, express or implied. We do
            not warrant that the Platform will be uninterrupted, error-free, or free of viruses or other harmful
            components.
          </p>

          <h2 className="mt-6 text-base font-semibold text-slate-900">5. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, iCapOS shall not be liable for any indirect, incidental,
            special, consequential, or punitive damages arising from your use of the Platform.
          </p>

          <h2 className="mt-6 text-base font-semibold text-slate-900">6. Governing Law</h2>
          <p>
            These Terms are governed by the laws of the State of Delaware, without regard to its conflict of law
            provisions.
          </p>

          <h2 className="mt-6 text-base font-semibold text-slate-900">7. Changes to Terms</h2>
          <p>
            We reserve the right to modify these Terms at any time. We will notify you of any changes by posting
            the new Terms on the Platform. Your continued use after such changes constitutes your acceptance of the
            new Terms.
          </p>

          <h2 className="mt-6 text-base font-semibold text-slate-900">8. Contact</h2>
          <p>
            If you have questions about these Terms, please contact us at{" "}
            <a href="mailto:legal@icapos.com" className="text-[var(--navy)] underline">
              legal@icapos.com
            </a>
            .
          </p>
        </div>

        <div className="mt-12 border-t border-slate-200 pt-8 text-xs text-slate-400">
          <p>
            iCapOS · icapos.com ·{" "}
            <Link href="/privacy" className="hover:underline">
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
