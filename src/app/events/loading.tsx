import { MarketingShell } from "@/components/marketing/MarketingShell";

export default function EventsLoading() {
  return (
    <MarketingShell>
      <section className="mx-auto max-w-5xl px-4 py-16">
        <div className="enterprise-skeleton h-4 w-24 rounded" />
        <div className="enterprise-skeleton mt-3 h-9 w-2/3 rounded" />
        <div className="enterprise-skeleton mt-3 h-4 w-1/2 rounded" />
        <div className="mt-10 grid gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-[var(--border-subtle)] bg-white px-6 py-5">
              <div className="enterprise-skeleton h-4 w-20 rounded" />
              <div className="enterprise-skeleton mt-3 h-5 w-1/2 rounded" />
              <div className="enterprise-skeleton mt-2 h-3 w-1/3 rounded" />
            </div>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}
