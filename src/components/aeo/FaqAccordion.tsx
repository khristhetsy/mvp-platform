// FAQ rendered as a native <details> accordion — fully expandable, but the answer
// text is always present in the server HTML (crawlers get the complete answer even
// with JS disabled). The matching FAQPage JSON-LD is emitted by the page.

import type { FaqItem } from "@/lib/aeo/types";
import { useTranslations } from "next-intl";

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const t = useTranslations("sharedCmp");
  if (items.length === 0) return null;
  return (
    <section data-aeo="faq" aria-label="Frequently asked questions">
      <h2 className="text-xl font-semibold text-slate-900 md:text-2xl">{t("frequently_asked_questions")}</h2>
      <div className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200">
        {items.map((f, i) => (
          <details key={i} className="group px-5 py-4" data-aeo="faq-item">
            <summary className="cursor-pointer list-none text-base font-medium text-slate-900 marker:content-none">
              <span className="flex items-center justify-between gap-4">
                {f.q}
                <span aria-hidden className="text-slate-400 transition-transform group-open:rotate-45">+</span>
              </span>
            </summary>
            <p className="mt-3 leading-relaxed text-slate-700">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
