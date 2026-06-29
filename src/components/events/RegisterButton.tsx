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
  if (!isAuthenticated) {
    return (
      <Link
        href={`/auth/sign-in?next=/events/${slug}/register`}
        className="cap-btn-primary inline-flex items-center rounded-md px-4 py-2 text-sm font-medium"
      >
        Sign in to register
      </Link>
    );
  }

  if (alreadyRegistered) {
    return (
      <span className="inline-flex items-center rounded-md bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
        ✓ You&apos;re registered
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
