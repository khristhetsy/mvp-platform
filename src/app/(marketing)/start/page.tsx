import type { Metadata } from "next";
import { start } from "@/content/start";
import { StartForm } from "@/components/marketing-site/StartForm";

export const metadata: Metadata = {
  title: "Get started — iCapOS",
  description:
    "Create your iCapOS account. The Capital Readiness Rating is free and needs no card — you only choose a plan when you're ready to start distribution.",
  alternates: { canonical: "/start" },
};

const Eyebrow = ({ children, onDark = false }: { children: React.ReactNode; onDark?: boolean }) => (
  <p className={`font-site-mono text-xs font-semibold uppercase tracking-[0.16em] ${onDark ? "text-site-blue-lt" : "text-site-blue"}`}>{children}</p>
);

export default function StartPage() {
  const s = start;
  return (
    <>
      <section className="bg-gradient-to-b from-site-navy to-site-navy-2 px-6 pb-16 pt-20 text-white">
        <div className="mx-auto grid max-w-6xl items-start gap-12 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <Eyebrow onDark>{s.eyebrow}</Eyebrow>
            <h1 className="mt-4 font-site-display text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">{s.title}</h1>
            <p className="mt-6 max-w-md text-lg leading-8 text-white/75">{s.sub}</p>
            <div className="mt-10">
              <Eyebrow onDark>{s.whatNext.eyebrow}</Eyebrow>
              <h2 className="mt-2 font-site-display text-xl font-bold">{s.whatNext.title}</h2>
              <ol className="mt-4 space-y-3">
                {s.whatNext.steps.map((st) => (
                  <li key={st.n} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-site-blue/25 font-site-mono text-xs font-semibold text-site-blue-lt">{st.n}</span><span className="text-[13.5px] leading-6 text-white/75">{st.p}</span></li>
                ))}
              </ol>
            </div>
          </div>
          <div className="text-site-ink">
            <StartForm />
          </div>
        </div>
      </section>

      {/* Your data */}
      <section className="bg-white px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <Eyebrow>{s.yourData.eyebrow}</Eyebrow>
          <h2 className="mt-3 font-site-display text-2xl font-extrabold tracking-tight text-site-navy sm:text-3xl">{s.yourData.title}</h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {s.yourData.points.map((p) => (<li key={p} className="flex gap-2 rounded-xl border border-site-line bg-site-paper px-4 py-3 text-[14px] text-site-ink"><span className="text-site-blue">✓</span>{p}</li>))}
          </ul>
        </div>
      </section>
    </>
  );
}
