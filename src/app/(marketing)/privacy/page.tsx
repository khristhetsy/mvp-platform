import type { Metadata } from "next";

/**
 * Privacy Policy (upgrade brief Step 2). SCAFFOLD ONLY — required GDPR section
 * structure is in place; substantive content is left as "TKTK" for legal review.
 * Do not draft policy text here. Distinct route from /terms and /disclosures.
 * Required stubs: data collected, lawful basis, retention, third-party
 * processors, international transfers, data subject rights.
 */

export const metadata: Metadata = {
  title: "Privacy Policy — iCapOS",
  description: "How iCapOS, a product of iCFO Capital Global, Inc., collects, uses, and protects personal data.",
  alternates: { canonical: "/privacy" },
};

const EFFECTIVE_DATE = "TKTK";

const SECTIONS: { h: string; body: string; items?: string[] }[] = [
  { h: "1. Data we collect", body: "TKTK — pending legal review." },
  { h: "2. Lawful basis for processing", body: "TKTK — pending legal review." },
  { h: "3. How we use your data", body: "TKTK — pending legal review." },
  { h: "4. Data retention", body: "TKTK — pending legal review." },
  { h: "5. Third-party processors", body: "TKTK — pending legal review." },
  { h: "6. International data transfers", body: "TKTK — pending legal review." },
  {
    h: "7. Your data subject rights",
    body: "TKTK — pending legal review. This section will describe how to exercise each of the following rights:",
    items: ["Access", "Rectification", "Erasure", "Portability", "Objection"],
  },
  { h: "8. Cookies and similar technologies", body: "TKTK — pending legal review." },
  { h: "9. Contact and data protection enquiries", body: "TKTK — pending legal review." },
];

export default function PrivacyPage() {
  return (
    <>
      <section className="bg-gradient-to-b from-site-navy to-site-navy-2 px-6 pb-16 pt-20 text-white">
        <div className="mx-auto max-w-3xl">
          <p className="font-site-mono text-xs font-semibold uppercase tracking-[0.16em] text-site-blue-lt">Legal</p>
          <h1 className="mt-3 font-site-display text-4xl font-extrabold tracking-tight sm:text-5xl">Privacy Policy</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/70">
            How iCapOS, a product of iCFO Capital Global, Inc., handles personal data.
          </p>
          <p className="mt-4 font-site-mono text-[12px] text-white/50">Effective date: {EFFECTIVE_DATE}</p>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <p className="rounded-xl border border-site-line bg-site-paper px-5 py-4 font-site-mono text-[12px] leading-6 text-site-muted">
            This page is a scaffold. Substantive content is pending legal review and is marked TKTK; nothing here is final until reviewed and published.
          </p>
          <div className="mt-10 space-y-8">
            {SECTIONS.map((s) => (
              <div key={s.h} className="border-t border-site-line pt-8 first:border-t-0 first:pt-0">
                <h2 className="font-site-display text-xl font-bold text-site-navy">{s.h}</h2>
                <p className="mt-3 text-[15px] leading-7 text-site-muted">{s.body}</p>
                {s.items ? (
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                    {s.items.map((it) => (
                      <li key={it} className="flex gap-2 rounded-lg border border-site-line bg-white px-3 py-2 text-[14px] text-site-ink">
                        <span className="text-site-blue">•</span>{it} <span className="font-site-mono text-[11px] text-site-muted/70">— TKTK</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
