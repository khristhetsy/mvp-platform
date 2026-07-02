// Shared server-rendered body for an AEO page. Used by BOTH the public
// /learn/[slug] route and the admin preview, so the preview is byte-for-byte the
// same output an AI crawler sees (minus the admin-only X-ray overlay).

import type { AeoPage } from "@/lib/aeo/types";
import { CitableAnswer } from "./CitableAnswer";
import { AeoSectionBlock } from "./AeoSection";
import { FaqAccordion } from "./FaqAccordion";
import { ComplianceFooter } from "./ComplianceFooter";

export function AeoPageBody({ page }: { page: AeoPage }) {
  return (
    <article className="mx-auto max-w-3xl px-5 py-12 md:py-16">
      <header>
        {page.eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#534AB7]">{page.eyebrow}</p>
        ) : null}
        <h1 className="mt-2 text-3xl font-semibold leading-tight text-slate-950 md:text-4xl">{page.h1}</h1>
        {page.lede ? <p className="mt-3 text-lg leading-relaxed text-slate-600">{page.lede}</p> : null}
      </header>

      <div className="mt-8">
        <CitableAnswer term={page.definedTerm} answer={page.definitionAnswer} />
      </div>

      {page.sections.length > 0 ? (
        <div className="mt-10 space-y-9">
          {page.sections.map((s) => (
            <AeoSectionBlock key={s.id} section={s} />
          ))}
        </div>
      ) : null}

      {page.faq.length > 0 ? (
        <div className="mt-12">
          <FaqAccordion items={page.faq} />
        </div>
      ) : null}

      <ComplianceFooter />
    </article>
  );
}
