import type { Metadata } from "next";

/**
 * Terms of Service (upgrade brief Step 2). SCAFFOLD ONLY — section structure and
 * headings are in place; substantive clauses are left as "TKTK" for legal review.
 * Do not draft legal terms here. Distinct route from /privacy and /disclosures.
 */

export const metadata: Metadata = {
  title: "Terms of Service — iCapOS",
  description: "The terms governing use of the iCapOS platform, a product of iCFO Capital Global, Inc.",
  alternates: { canonical: "/terms" },
};

const EFFECTIVE_DATE = "TKTK";

const SECTIONS: { h: string; body: string }[] = [
  { h: "1. Agreement to these terms", body: "TKTK — pending legal review." },
  { h: "2. The service", body: "TKTK — pending legal review." },
  { h: "3. Eligibility and accounts", body: "TKTK — pending legal review." },
  { h: "4. Acceptable use", body: "TKTK — pending legal review." },
  { h: "5. Fees and billing", body: "TKTK — pending legal review." },
  { h: "6. Intellectual property", body: "TKTK — pending legal review." },
  { h: "7. Third-party services", body: "TKTK — pending legal review." },
  { h: "8. Disclaimers", body: "TKTK — pending legal review." },
  { h: "9. Limitation of liability", body: "TKTK — pending legal review." },
  { h: "10. Indemnification", body: "TKTK — pending legal review." },
  { h: "11. Term and termination", body: "TKTK — pending legal review." },
  { h: "12. Governing law and disputes", body: "TKTK — pending legal review." },
  { h: "13. Changes to these terms", body: "TKTK — pending legal review." },
  { h: "14. Contact", body: "TKTK — pending legal review." },
];

export default function TermsPage() {
  return (
    <>
      <section className="bg-gradient-to-b from-site-navy to-site-navy-2 px-6 pb-16 pt-20 text-white">
        <div className="mx-auto max-w-3xl">
          <p className="font-site-mono text-xs font-semibold uppercase tracking-[0.16em] text-site-blue-lt">Legal</p>
          <h1 className="mt-3 font-site-display text-4xl font-extrabold tracking-tight sm:text-5xl">Terms of Service</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/70">
            These terms govern your use of iCapOS, a software platform from iCFO Capital Global, Inc.
          </p>
          <p className="mt-4 font-site-mono text-[12px] text-white/50">Effective date: {EFFECTIVE_DATE}</p>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <p className="rounded-xl border border-site-line bg-site-paper px-5 py-4 font-site-mono text-[12px] leading-6 text-site-muted">
            This page is a scaffold. Substantive clauses are pending legal review and are marked TKTK; nothing here is final or binding until reviewed and published.
          </p>
          <div className="mt-10 space-y-8">
            {SECTIONS.map((s) => (
              <div key={s.h} className="border-t border-site-line pt-8 first:border-t-0 first:pt-0">
                <h2 className="font-site-display text-xl font-bold text-site-navy">{s.h}</h2>
                <p className="mt-3 text-[15px] leading-7 text-site-muted">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
