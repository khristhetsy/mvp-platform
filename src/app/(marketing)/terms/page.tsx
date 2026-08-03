import type { Metadata } from "next";
import { CounselReviewBanner } from "@/components/legal/CounselReviewBanner";

/**
 * Terms of Service (upgrade brief Step 2). Ported into the marketing route group
 * so it carries the site nav + footer. Clause TEXT is verbatim from the prior
 * top-level /terms page (effective June 1, 2025) — reskinned to marketing tokens
 * only. Legal content is load-bearing: do not reword.
 */

export const metadata: Metadata = {
  title: "Terms of Service — iCapOS",
  description: "The terms governing use of the iCapOS platform, a product of iCFO Capital Global, Inc.",
  alternates: { canonical: "/terms" },
};

const EFFECTIVE = "June 1, 2025";

const SECTIONS: { h: string; body: string }[] = [
  { h: "1. Acceptance of Terms", body: "These Terms constitute a legally binding agreement between you and iCapOS. If you do not agree to these Terms, you may not use the Platform." },
  { h: "2. Use of the Platform", body: "You agree to use the Platform only for lawful purposes and in accordance with these Terms. You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account." },
  { h: "3. Intellectual Property", body: "All content, features, and functionality of the Platform are owned by iCapOS and are protected by applicable intellectual property laws. You may not reproduce, distribute, or create derivative works without our express written permission." },
  { h: "4. Disclaimer of Warranties", body: "The Platform is provided “as is” without warranties of any kind, express or implied. We do not warrant that the Platform will be uninterrupted, error-free, or free of viruses or other harmful components." },
  { h: "5. Limitation of Liability", body: "To the maximum extent permitted by law, iCapOS shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Platform." },
  { h: "6. Governing Law", body: "These Terms are governed by the laws of the State of Delaware, without regard to its conflict of law provisions." },
  { h: "7. Changes to Terms", body: "We reserve the right to modify these Terms at any time. We will notify you of any changes by posting the new Terms on the Platform. Your continued use after such changes constitutes your acceptance of the new Terms." },
];

export default function TermsPage() {
  return (
    <>
      <section className="bg-gradient-to-b from-site-navy to-site-navy-2 px-6 pb-16 pt-20 text-white">
        <div className="mx-auto max-w-3xl">
          <p className="font-site-mono text-xs font-semibold uppercase tracking-[0.16em] text-site-blue-lt">Legal</p>
          <h1 className="mt-3 font-site-display text-4xl font-extrabold tracking-tight sm:text-5xl">Terms of Service</h1>
          <p className="mt-4 font-site-mono text-[12px] text-white/50">Effective date: {EFFECTIVE}</p>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <CounselReviewBanner />
          <p className="mt-8 text-[15px] leading-7 text-site-muted">
            By accessing or using iCapOS (“the Platform”), you agree to be bound by these Terms of Service. Please read them carefully.
          </p>
          <div className="mt-8 space-y-8">
            {SECTIONS.map((s) => (
              <div key={s.h} className="border-t border-site-line pt-8">
                <h2 className="font-site-display text-xl font-bold text-site-navy">{s.h}</h2>
                <p className="mt-3 text-[15px] leading-7 text-site-muted">{s.body}</p>
              </div>
            ))}
            <div className="border-t border-site-line pt-8">
              <h2 className="font-site-display text-xl font-bold text-site-navy">8. Contact</h2>
              <p className="mt-3 text-[15px] leading-7 text-site-muted">
                If you have questions about these Terms, please contact us at{" "}
                <a href="mailto:legal@icapos.com" className="text-site-blue underline underline-offset-2 hover:text-site-blue-hi">legal@icapos.com</a>.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
