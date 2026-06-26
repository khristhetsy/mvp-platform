import Link from "next/link";
import { CounselReviewBanner } from "@/components/legal/CounselReviewBanner";

export const metadata = { title: "Security – CapitalOS" };

/**
 * Security overview — structure and headings only. Substantive security
 * commitments are counsel/security-team reviewed copy; do not invent specifics.
 */
export default function SecurityPage() {
  const sections = [
    { h: "1. Data protection", note: "Encryption in transit and at rest; key management. (Pending review.)" },
    { h: "2. Infrastructure", note: "Hosting, isolation, and backup posture. (Pending review.)" },
    { h: "3. Access controls", note: "Role-based access, least privilege, and audit logging. (Pending review.)" },
    { h: "4. Application security", note: "Secure development, dependency, and review practices. (Pending review.)" },
    { h: "5. Vulnerability disclosure", note: "How to report a security issue responsibly. (Pending review.)" },
    { h: "6. Compliance & subprocessors", note: "Standards alignment and third-party processors. (Pending review.)" },
    { h: "7. Contact", note: "Reach the security team for questions or reports. (Pending review.)" },
  ];

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="mb-10">
          <Link href="/" className="text-sm font-semibold text-[var(--navy)] hover:underline">
            ← Back to CapitalOS
          </Link>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-950">Security</h1>
          <p className="mt-2 text-sm text-slate-500">How CapitalOS protects platform data.</p>
        </div>

        <CounselReviewBanner />

        <div className="text-sm leading-7 text-slate-700">
          <p>
            CapitalOS is a technology and diligence platform. This page outlines our security approach. Final
            commitments below are pending security-team and counsel review.
          </p>
          {sections.map((s) => (
            <section key={s.h}>
              <h2 className="mt-6 text-base font-semibold text-slate-900">{s.h}</h2>
              <p className="mt-1 text-slate-500">{s.note}</p>
            </section>
          ))}
          <p className="mt-8">
            Security questions or reports:{" "}
            <a href="mailto:security@icapos.com" className="text-[var(--navy)] underline">
              security@icapos.com
            </a>
            .
          </p>
        </div>

        <div className="mt-12 border-t border-slate-200 pt-8 text-xs text-slate-400">
          <p>
            CapitalOS · icapos.com ·{" "}
            <Link href="/privacy" className="hover:underline">Privacy</Link>
            {" · "}
            <Link href="/terms" className="hover:underline">Terms</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
