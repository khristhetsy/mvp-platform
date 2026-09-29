"use client";

import Link from "next/link";

/** Routes to the multi-role registration form (no longer a one-click POST). */
export function RegisterButton({
  slug,
  isAuthenticated,
  alreadyRegistered,
}: {
  eventId: string;
  slug: string;
  isAuthenticated: boolean;
  alreadyRegistered: boolean;
}) {
  // Registration is open without an account; signing in only prefills it.
  if (!isAuthenticated) {
    return (
      <span className="inline-flex flex-wrap items-center gap-3">
        <Link
          href={`/events/${slug}/register`}
          className="cap-btn-primary inline-flex items-center rounded-md px-4 py-2 text-sm font-medium"
        >
          Register to attend
        </Link>
        <Link href={`/auth/sign-in?next=/events/${slug}/register`} className="text-sm text-[var(--text-muted)] underline">
          Have an account? Sign in
        </Link>
      </span>
    );
  }

  if (alreadyRegistered) {
    return (
      <span className="inline-flex items-center rounded-md bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
        <i className="ti ti-check" aria-hidden="true" /> You&apos;re registered
      </span>
    );
  }

  return (
    <Link
      href={`/events/${slug}/register`}
      className="cap-btn-primary inline-flex items-center rounded-md px-4 py-2 text-sm font-medium"
    >
      Register to attend
    </Link>
  );
}
