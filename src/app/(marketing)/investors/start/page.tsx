import type { Metadata } from "next";
import { investorStart } from "@/content/investor-start";
import { InvestorStartForm } from "@/components/marketing-site/InvestorStartForm";

export const metadata: Metadata = {
  title: "Create your investor account — iCapOS",
  description: "Free for investors. Set your mandate and monthly limit, and receive only rated companies that fit.",
  alternates: { canonical: "/investors/start" },
};

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <p className="font-site-mono text-xs font-semibold uppercase tracking-[0.16em] text-site-blue-lt">{children}</p>
);

export default function InvestorStartPage() {
  const s = investorStart;
  return (
    <section className="bg-gradient-to-b from-site-navy to-site-navy-2 px-6 pb-16 pt-20 text-white">
      <div className="mx-auto grid max-w-6xl items-start gap-12 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <Eyebrow>{s.eyebrow}</Eyebrow>
          <h1 className="mt-4 font-site-display text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">{s.title}</h1>
          <p className="mt-6 max-w-md text-lg leading-8 text-white/75">{s.sub}</p>
          <ol className="mt-10 space-y-3">
            {s.steps.map((st) => (
              <li key={st.n} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-site-blue/25 font-site-mono text-xs font-semibold text-site-blue-lt">{st.n}</span>
                <span className="text-[13.5px] leading-6 text-white/75">{st.p}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="text-site-ink">
          <InvestorStartForm />
        </div>
      </div>
    </section>
  );
}
