import type { Metadata } from "next";
import { CounselReviewBanner } from "@/components/legal/CounselReviewBanner";

/**
 * Privacy Policy (upgrade brief Step 2). Ported into the marketing route group
 * so it carries the site nav + footer. Clause TEXT is verbatim from the prior
 * top-level /privacy page (effective June 1, 2025) — reskinned to marketing
 * tokens only. Legal content is load-bearing: do not reword.
 */

export const metadata: Metadata = {
  title: "Privacy Policy — iCapOS",
  description: "How iCapOS, a product of iCFO Capital Global, Inc., collects, uses, and protects personal data.",
  alternates: { canonical: "/privacy" },
};

const EFFECTIVE = "June 1, 2025";

export default function PrivacyPage() {
  return (
    <>
      <section className="bg-gradient-to-b from-site-navy to-site-navy-2 px-6 pb-16 pt-20 text-white">
        <div className="mx-auto max-w-3xl">
          <p className="font-site-mono text-xs font-semibold uppercase tracking-[0.16em] text-site-blue-lt">Legal</p>
          <h1 className="mt-3 font-site-display text-4xl font-extrabold tracking-tight sm:text-5xl">Privacy Policy</h1>
          <p className="mt-4 font-site-mono text-[12px] text-white/50">Effective date: {EFFECTIVE}</p>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <CounselReviewBanner />
          <p className="mt-8 text-[15px] leading-7 text-site-muted">
            iCapOS (“we”, “us”, or “our”) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our platform.
          </p>

          <div className="mt-8 space-y-8">
            <div className="border-t border-site-line pt-8">
              <h2 className="font-site-display text-xl font-bold text-site-navy">1. Information We Collect</h2>
              <p className="mt-3 text-[15px] leading-7 text-site-muted">We collect information you provide directly, such as your name, email address, company details, and financial data you enter into the Platform. We also collect usage data, log files, and device information automatically when you access the Platform.</p>
            </div>
            <div className="border-t border-site-line pt-8">
              <h2 className="font-site-display text-xl font-bold text-site-navy">2. How We Use Your Information</h2>
              <p className="mt-3 text-[15px] leading-7 text-site-muted">We use collected information to:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] leading-7 text-site-muted">
                <li>Provide, operate, and maintain the Platform</li>
                <li>Match founders with investors based on stated criteria</li>
                <li>Send transactional and product communications</li>
                <li>Improve and personalize your experience</li>
                <li>Comply with legal obligations</li>
              </ul>
            </div>
            <div className="border-t border-site-line pt-8">
              <h2 className="font-site-display text-xl font-bold text-site-navy">3. Sharing of Information</h2>
              <p className="mt-3 text-[15px] leading-7 text-site-muted">We do not sell your personal information. We may share information with investors you choose to engage with through the Platform, and with service providers who assist us in operating the Platform, subject to confidentiality obligations.</p>
            </div>
            <div className="border-t border-site-line pt-8">
              <h2 className="font-site-display text-xl font-bold text-site-navy">4. Data Security</h2>
              <p className="mt-3 text-[15px] leading-7 text-site-muted">We use industry-standard security measures including encryption in transit and at rest, role-based access controls, and signed URLs to protect your data. No method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.</p>
            </div>
            <div className="border-t border-site-line pt-8">
              <h2 className="font-site-display text-xl font-bold text-site-navy">5. Data Retention</h2>
              <p className="mt-3 text-[15px] leading-7 text-site-muted">We retain your information for as long as your account is active or as needed to provide services. You may request deletion of your account and associated data by contacting us.</p>
            </div>
            <div className="border-t border-site-line pt-8">
              <h2 className="font-site-display text-xl font-bold text-site-navy">6. Your Rights</h2>
              <p className="mt-3 text-[15px] leading-7 text-site-muted">
                Depending on your location, you may have rights to access, correct, delete, or port your personal data. To exercise any of these rights, contact us at{" "}
                <a href="mailto:privacy@icapos.com" className="text-site-blue underline underline-offset-2 hover:text-site-blue-hi">privacy@icapos.com</a>.
              </p>
            </div>
            <div className="border-t border-site-line pt-8">
              <h2 className="font-site-display text-xl font-bold text-site-navy">7. Cookies</h2>
              <p className="mt-3 text-[15px] leading-7 text-site-muted">We use essential cookies required for authentication and session management. We do not use tracking or advertising cookies.</p>
            </div>
            <div className="border-t border-site-line pt-8">
              <h2 className="font-site-display text-xl font-bold text-site-navy">8. Changes to This Policy</h2>
              <p className="mt-3 text-[15px] leading-7 text-site-muted">We may update this Privacy Policy from time to time. We will notify you of material changes by email or by posting a notice on the Platform.</p>
            </div>
            <div className="border-t border-site-line pt-8">
              <h2 className="font-site-display text-xl font-bold text-site-navy">9. Contact</h2>
              <p className="mt-3 text-[15px] leading-7 text-site-muted">
                Questions about this Privacy Policy? Contact us at{" "}
                <a href="mailto:privacy@icapos.com" className="text-site-blue underline underline-offset-2 hover:text-site-blue-hi">privacy@icapos.com</a>.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
