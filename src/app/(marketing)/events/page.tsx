import type { Metadata } from "next";
import Link from "next/link";
import { events } from "@/content/events";
import { JsonLd } from "@/components/seo/JsonLd";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Events — iCFO Investment Conference & PE Expo",
  description:
    "iCFO runs a monthly investment conference and an in-person PE Expo where rated companies present to investors. Free to attend. Next: iCFO PE Expo, Newport Beach, August 25, 2026.",
  alternates: { canonical: "/events" },
};

type MarketingEvent = {
  id: string;
  title: string;
  kind: string | null;
  city: string | null;
  starts_at: string | null;
  ends_at: string | null;
  registration_open: boolean | null;
  banner_url: string | null;
};

async function loadEvents(): Promise<MarketingEvent[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createServiceRoleClient() as any;
    const { data } = await admin
      .from("marketing_events")
      .select("id, title, kind, city, starts_at, ends_at, registration_open, banner_url")
      .order("sort_order", { ascending: true })
      .order("starts_at", { ascending: true });
    return (data ?? []) as MarketingEvent[];
  } catch {
    return [];
  }
}

const Eyebrow = ({ children, onDark = false }: { children: React.ReactNode; onDark?: boolean }) => (
  <p className={`font-site-mono text-xs font-semibold uppercase tracking-[0.16em] ${onDark ? "text-site-blue-lt" : "text-site-blue"}`}>{children}</p>
);

function fmtDate(iso: string | null): string {
  if (!iso) return "Date to be confirmed";
  return new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Los_Angeles" });
}

export default async function EventsPage() {
  const e = events;
  const rows = await loadEvents();

  const eventJsonLd = rows
    .filter((r) => r.starts_at)
    .map((r) => ({
      "@context": "https://schema.org",
      "@type": "Event",
      name: r.title,
      startDate: r.starts_at,
      endDate: r.ends_at ?? undefined,
      eventAttendanceMode: r.kind === "conference" ? "https://schema.org/OnlineEventAttendanceMode" : "https://schema.org/OfflineEventAttendanceMode",
      location: r.city ? { "@type": "Place", name: r.city } : undefined,
      organizer: { "@type": "Organization", name: "iCFO Capital Global, Inc." },
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD", availability: r.registration_open ? "https://schema.org/InStock" : "https://schema.org/PreOrder" },
    }));

  return (
    <>
      {eventJsonLd.map((d, i) => (<JsonLd key={i} data={d} />))}

      {/* Hero */}
      <section className="bg-gradient-to-b from-site-navy to-site-navy-2 px-6 pb-14 pt-20 text-white">
        <div className="mx-auto max-w-4xl">
          <Eyebrow onDark>{e.hero.eyebrow}</Eyebrow>
          <h1 className="mt-4 max-w-3xl font-site-display text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">{e.hero.title}</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/75">{e.hero.sub}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={e.hero.primaryCta.href} className="rounded-lg bg-site-blue px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi">{e.hero.primaryCta.label}</Link>
            <Link href={e.hero.secondaryCta.href} className="rounded-lg border border-white/20 px-5 py-3 text-sm font-semibold text-white transition-colors hover:border-site-blue-lt hover:text-site-blue-lt">{e.hero.secondaryCta.label}</Link>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-3 rounded-xl border border-site-blue-lt/25 bg-site-blue/10 px-5 py-3">
            <span className="font-site-mono text-[11px] uppercase tracking-wider text-site-blue-lt">Next event</span>
            <span className="font-medium">{e.hero.nextBanner.title}</span>
            <span className="text-white/60">{e.hero.nextBanner.detail}</span>
          </div>
          <p className="mt-4 font-site-mono text-[11px] leading-5 text-white/45">{e.hero.compliance}</p>
        </div>
      </section>

      {/* Event series */}
      <section className="bg-white px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-baseline gap-3"><h2 className="font-site-display text-2xl font-extrabold text-site-navy">{e.series.title}</h2><span className="font-site-mono text-xs uppercase tracking-wider text-site-muted">{e.series.tag}</span></div>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {e.series.items.map((i) => (
              <div key={i.code} className="rounded-2xl border border-site-line bg-site-paper p-6"><span className="font-site-mono text-xs font-semibold text-site-blue">{i.code}</span><h3 className="mt-2 font-site-display text-base font-bold text-site-navy">{i.h}</h3><p className="mt-1 text-sm leading-6 text-site-muted">{i.p}</p></div>
            ))}
          </div>
          <p className="mt-4 font-site-mono text-[12px] text-site-muted">{e.series.note}</p>
        </div>
      </section>

      {/* Schedule (from marketing_events) */}
      <section className="bg-site-paper px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <Eyebrow>{e.schedule.eyebrow}</Eyebrow>
          <h2 className="mt-3 font-site-display text-3xl font-extrabold tracking-tight text-site-navy">{e.schedule.title}</h2>
          <p className="mt-4 max-w-2xl text-site-muted">{e.schedule.sub}</p>
          <div className="mt-8 space-y-4">
            {rows.length === 0 ? (
              <p className="rounded-xl border border-site-line bg-white px-5 py-8 text-center text-sm text-site-muted">The schedule is being confirmed — check back soon.</p>
            ) : rows.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-site-line bg-white px-6 py-5">
                <div className="font-site-mono text-sm font-semibold uppercase text-site-blue">{fmtDate(r.starts_at)}</div>
                <div className="min-w-0 flex-1">
                  <div className="font-site-display text-lg font-bold text-site-navy">{r.title}</div>
                  {r.city ? <div className="text-[13px] text-site-muted">{r.city}</div> : null}
                </div>
                {r.registration_open ? (
                  <><span className="rounded-full bg-site-blue-pale px-2.5 py-0.5 font-site-mono text-[10px] font-medium text-site-blue">Registration open</span>
                  <Link href={e.hero.primaryCta.href} className="rounded-lg bg-site-blue px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi">Register free</Link></>
                ) : (
                  <><span className="rounded-full bg-site-paper px-2.5 py-0.5 font-site-mono text-[10px] font-medium text-site-muted">Date to be confirmed</span>
                  <Link href={e.hero.primaryCta.href} className="rounded-lg border border-site-line px-4 py-2 text-sm font-semibold text-site-navy transition-colors hover:border-site-blue-hi hover:text-site-blue-hi">Notify me</Link></>
                )}
              </div>
            ))}
          </div>
          <p className="mt-4 font-site-mono text-[11px] text-site-muted/80">{e.schedule.note}</p>
        </div>
      </section>

      {/* The format + run of show */}
      <section className="bg-white px-6 py-16">
        <div className="mx-auto grid max-w-6xl items-start gap-10 lg:grid-cols-2">
          <div>
            <Eyebrow>{e.format.eyebrow}</Eyebrow>
            <h2 className="mt-3 font-site-display text-3xl font-extrabold tracking-tight text-site-navy">{e.format.title}</h2>
            <p className="mt-4 text-[15px] leading-7 text-site-muted">{e.format.p}</p>
            <ul className="mt-4 space-y-2">{e.format.points.map((p) => (<li key={p} className="flex gap-2 text-[14px] text-site-ink"><span className="text-site-blue">✓</span>{p}</li>))}</ul>
          </div>
          <div className="rounded-2xl border border-site-line bg-site-paper p-6">
            <div className="flex items-baseline justify-between"><span className="font-site-display text-base font-bold text-site-navy">{e.format.runTitle}</span><span className="font-site-mono text-xs text-site-muted">{e.format.runTag}</span></div>
            <ul className="mt-4 space-y-3">
              {e.format.run.map((r) => (<li key={r.t} className="flex gap-4"><span className="font-site-mono text-sm font-semibold text-site-blue">{r.t}</span><div><div className="text-sm font-medium text-site-navy">{r.h}</div><div className="text-[12px] text-site-muted">{r.p}</div></div></li>))}
            </ul>
          </div>
        </div>
      </section>

      {/* Two ways to be seen */}
      <section className="bg-site-paper px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-baseline gap-3"><h2 className="font-site-display text-2xl font-extrabold text-site-navy">{e.twoWays.title}</h2><span className="text-site-muted">{e.twoWays.sub}</span></div>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {[e.twoWays.pro, e.twoWays.basic].map((w) => (
              <div key={w.tag} className="rounded-2xl border border-site-line bg-white p-7">
                <span className="font-site-mono text-[10px] font-semibold uppercase tracking-wider text-site-blue">{w.tag}</span>
                <h3 className="mt-2 font-site-display text-xl font-bold text-site-navy">{w.h}</h3>
                <p className="mt-2 text-sm leading-6 text-site-muted">{w.p}</p>
                <ul className="mt-4 space-y-2">{w.points.map((pt) => (<li key={pt} className="flex gap-2 text-[13px] text-site-ink"><span className="text-site-blue">✓</span>{pt}</li>))}</ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For investors */}
      <section className="bg-site-navy px-6 py-16 text-white">
        <div className="mx-auto max-w-4xl">
          <Eyebrow onDark>{e.forInvestors.eyebrow}</Eyebrow>
          <h2 className="mt-3 font-site-display text-2xl font-extrabold tracking-tight sm:text-3xl">{e.forInvestors.title}</h2>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-white/70">{e.forInvestors.p}</p>
          <ul className="mt-4 space-y-2">{e.forInvestors.points.map((p) => (<li key={p} className="flex gap-2 text-[14px] text-white/85"><span className="text-site-blue-lt">✓</span>{p}</li>))}</ul>
          <p className="mt-6 max-w-3xl font-site-mono text-[11px] leading-5 text-white/45">{e.forInvestors.compliance}</p>
        </div>
      </section>

      {/* Next up CTA */}
      <section className="bg-gradient-to-b from-site-navy-2 to-site-navy px-6 py-16 text-center text-white">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-site-display text-2xl font-extrabold tracking-tight sm:text-3xl">{e.nextUp.title}</h2>
          <p className="mt-4 text-lg text-white/70">{e.nextUp.sub}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href={e.nextUp.primaryCta.href} className="rounded-lg bg-site-blue px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi">{e.nextUp.primaryCta.label}</Link>
            <Link href={e.nextUp.secondaryCta.href} className="rounded-lg border border-white/20 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:border-site-blue-lt hover:text-site-blue-lt">{e.nextUp.secondaryCta.label}</Link>
          </div>
        </div>
      </section>
    </>
  );
}
