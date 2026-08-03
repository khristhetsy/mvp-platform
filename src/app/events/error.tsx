"use client";

import Link from "next/link";

export default function EventsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <h1 className="text-xl font-semibold text-[var(--navy)]">Something went wrong</h1>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        We couldn&apos;t load events just now. Please try again.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <button
          onClick={reset}
          className="cap-btn-primary rounded-md px-4 py-2 text-sm font-medium"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-md border border-[var(--border-subtle)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-slate-50"
        >
          Back home
        </Link>
      </div>
    </div>
  );
}
