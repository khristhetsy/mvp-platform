import Link from "next/link";
import { CounselReviewBanner } from "@/components/legal/CounselReviewBanner";

export const metadata = { title: "Privacy Policy – iCapOS" };

export default function PrivacyPage() {
  const effective = "June 1, 2025";

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto max-w-3xl px-6 py-16">
        {/* Header */}
        <div className="mb-10">
          <Link href="/" className="text-sm font-semibold text-[var(--navy)] hover:underline">
            ← Back to iCapOS
          </Link>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-950">Privacy Policy</h1>
          <p className="mt-2 text-sm text-slate-500">Effective date: {effective}</p>
        </div>

        <CounselReviewBanner />

        <div className="prose prose-slate max-w-none text-sm leading-7 text-slate-700">
          <p>
            iCapOS (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) is committed to protecting your
            privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use
            our platform.
          </p>

          <h2 className="mt-8 text-base font-semibold text-slate-900">1. Information We Collect</h2>
          <p>
            We collect information you provide directly, such as your name, email address, company details, and
            financial data you enter into the Platform. We also collect usage data, log files, and device
            information automatically when you access the Platform.
          </p>

          <h2 className="mt-6 text-base font-semibold text-slate-900">2. How We Use Your Information</h2>
          <p>We use collected information to:</p>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>Provide, operate, and maintain the Platform</li>
            <li>Match founders with investors based on stated criteria</li>
            <li>Send transactional and product communications</li>
            <li>Improve and personalize your experience</li>
            <li>Comply with legal obligations</li>
          </ul>

          <h2 className="mt-6 text-base font-semibold text-slate-900">3. Sharing of Information</h2>
          <p>
            We do not sell your personal information. We may share information with investors you choose to engage
            with through the Platform, and with service providers who assist us in operating the Platform, subject
            to confidentiality obligations.
          </p>

          <h2 className="mt-6 text-base font-semibold text-slate-900">4. Data Security</h2>
          <p>
            We use industry-standard security measures including encryption in transit and at rest, role-based
            access controls, and signed URLs to protect your data. No method of transmission over the internet is
            100% secure, and we cannot guarantee absolute security.
          </p>

          <h2 className="mt-6 text-base font-semibold text-slate-900">5. Data Retention</h2>
          <p>
            We retain your information for as long as your account is active or as needed to provide services. You
            may request deletion of your account and associated data by contacting us.
          </p>

          <h2 className="mt-6 text-base font-semibold text-slate-900">6. Your Rights</h2>
          <p>
            Depending on your location, you may have rights to access, correct, delete, or port your personal data.
            To exercise any of these rights, contact us at{" "}
            <a href="mailto:privacy@icapos.com" className="text-[var(--navy)] underline">
              privacy@icapos.com
            </a>
            .
          </p>

          <h2 className="mt-6 text-base font-semibold text-slate-900">7. Cookies</h2>
          <p>
            We use essential cookies required for authentication and session management. We do not use tracking or
            advertising cookies.
          </p>

          <h2 className="mt-6 text-base font-semibold text-slate-900">8. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of material changes by email or
            by posting a notice on the Platform.
          </p>

          <h2 className="mt-6 text-base font-semibold text-slate-900">9. Contact</h2>
          <p>
            Questions about this Privacy Policy? Contact us at{" "}
            <a href="mailto:privacy@icapos.com" className="text-[var(--navy)] underline">
              privacy@icapos.com
            </a>
            .
          </p>
        </div>

        <div className="mt-12 border-t border-slate-200 pt-8 text-xs text-slate-400">
          <p>
            iCapOS · icapos.com ·{" "}
            <Link href="/terms" className="hover:underline">
              Terms of Service
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
