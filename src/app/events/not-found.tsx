import Link from "next/link";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { MarketingFooter } from "@/components/MarketingFooter";

export default function EventNotFound() {
  return (
    <MarketingShell>
      <section className="mx-auto max-w-lg px-4 py-24 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--indigo)]">iCFO Events</p>
        <h1 className="mt-2 text-2xl font-bold text-[var(--navy)]">Event not found</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          This event may have ended, been unpublished, or never existed.
        </p>
        <Link
          href="/events"
          className="mt-6 inline-flex items-center rounded-md bg-[var(--indigo)] px-4 py-2 text-sm font-medium text-white"
        >
          Browse all events
        </Link>
      </section>
      <MarketingFooter />
    </MarketingShell>
  );
}
