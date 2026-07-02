// A self-contained section: <h2> heading + complete passage beneath. Server-rendered.

import type { AeoSection as Section } from "@/lib/aeo/types";

export function AeoSectionBlock({ section }: { section: Section }) {
  return (
    <section data-aeo="section" id={section.id} className="scroll-mt-24">
      <h2 className="text-xl font-semibold text-slate-900 md:text-2xl">{section.heading}</h2>
      <p className="mt-3 leading-relaxed text-slate-700">{section.body}</p>
    </section>
  );
}
