import type { Metadata } from "next";
import { assessment } from "@/content/assessment";
import { AssessmentFlow } from "@/components/marketing-site/AssessmentFlow";
import { FunnelBeacon } from "@/components/marketing-site/FunnelBeacon";

export const metadata: Metadata = {
  title: "Free assessment — iCapOS",
  description:
    "See your score band in ten questions — no account, no card. iCapOS is investor relations from iCFO Capital: access to matched investors from a 6,000+ network. The full Capital Readiness Rating comes with a paid plan.",
  alternates: { canonical: "/assessment" },
};

export default function AssessmentPage() {
  const a = assessment;
  return (
    <>
      <FunnelBeacon event="assessment_start" />
      <section className="bg-gradient-to-b from-site-navy to-site-navy-2 px-6 pb-10 pt-20 text-white">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-site-mono text-xs font-semibold uppercase tracking-[0.16em] text-site-blue-lt">{a.eyebrow}</p>
          <h1 className="mt-3 font-site-display text-4xl font-extrabold tracking-tight sm:text-5xl">{a.title}</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-8 text-white/70">{a.sub}</p>
        </div>
      </section>
      <section className="bg-site-paper px-6 pb-24 pt-12">
        <AssessmentFlow />
      </section>
    </>
  );
}
