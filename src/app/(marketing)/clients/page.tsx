import type { Metadata } from "next";
import Link from "next/link";
import { approvedStories, clientStoriesCopy as copy, storiesSummary } from "@/content/client-stories";
import { ClientStories } from "@/components/marketing-site/ClientStories";
import { FounderResultsSection } from "@/components/marketing-site/FounderResultsSection";

export const metadata: Metadata = {
  title: copy.metaTitle,
  description: copy.metaDescription,
  alternates: { canonical: "/clients" },
};

const Eyebrow = ({ children, onDark = false }: { children: React.ReactNode; onDark?: boolean }) => (
  <p className={`font-site-mono text-xs font-semibold uppercase tracking-[0.16em] ${onDark ? "text-site-blue-lt" : "text-site-steel"}`}>{children}</p>
);

export default function ClientsPage() {
  const stories = approvedStories();
  return (
    <>
      {/* Hero */}
      <section className="bg-site-paper px-6 pb-14 pt-20">
        <div className="mx-auto max-w-6xl">
          <Eyebrow>{copy.hero.eyebrow}</Eyebrow>
          <h1 className="mt-4 max-w-3xl font-site-display text-4xl font-extrabold leading-[1.06] tracking-tight text-site-navy sm:text-5xl lg:text-6xl">{copy.hero.title}</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-site-muted">{copy.hero.sub}</p>
        </div>
      </section>

      <ClientStories stories={stories} summary={storiesSummary()} />

      {/* More founder results: renders only once enough approved entries exist */}
      <FounderResultsSection />

      {/* CTA */}
      <section className="bg-site-blue px-6 py-20 text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <div className="max-w-xl">
            <h2 className="font-site-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">{copy.cta.title}</h2>
            <p className="mt-4 text-lg leading-8 text-white">{copy.cta.sub}</p>
          </div>
          <Link href={copy.cta.href} className="rounded-lg bg-white px-7 py-4 text-base font-semibold text-site-navy transition-colors hover:bg-site-blue-pale">{copy.cta.label}</Link>
        </div>
      </section>

      <section className="bg-site-navy px-6 py-10">
        <p className="mx-auto max-w-6xl text-[12px] leading-5 text-white/70">{copy.disclaimer}</p>
      </section>
    </>
  );
}
