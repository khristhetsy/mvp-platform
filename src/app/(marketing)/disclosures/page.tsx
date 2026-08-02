import type { Metadata } from "next";
import { disclosures } from "@/content/disclosures";

export const metadata: Metadata = {
  title: "Disclosures — iCapOS",
  description:
    "What iCapOS is, and what it isn't: iCapOS is software from iCFO Capital Global, Inc. — not a broker-dealer, funding portal, investment adviser, or placement agent. No investment advice, no guarantee of funding.",
  alternates: { canonical: "/disclosures" },
};

export default function DisclosuresPage() {
  const d = disclosures;
  return (
    <>
      <section className="bg-gradient-to-b from-site-navy to-site-navy-2 px-6 pb-16 pt-20 text-white">
        <div className="mx-auto max-w-3xl">
          <p className="font-site-mono text-xs font-semibold uppercase tracking-[0.16em] text-site-blue-lt">{d.eyebrow}</p>
          <h1 className="mt-3 font-site-display text-4xl font-extrabold tracking-tight sm:text-5xl">{d.title}</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/70">{d.intro}</p>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-3xl space-y-8">
          {d.blocks.map((b) => (
            <div key={b.h} className="border-t border-site-line pt-8 first:border-t-0 first:pt-0">
              <h2 className="font-site-display text-xl font-bold text-site-navy">{b.h}</h2>
              <p className="mt-3 text-[15px] leading-7 text-site-muted">{b.p}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
