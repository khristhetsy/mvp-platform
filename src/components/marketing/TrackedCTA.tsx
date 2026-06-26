"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { track } from "@/lib/analytics/posthog";

/**
 * A marketing CTA link that fires a PostHog funnel event on click. Thin client
 * wrapper so the surrounding pages can stay server components. No-ops without a
 * PostHog key (the track() helper degrades gracefully).
 */
export function TrackedCTA({
  href,
  event,
  properties,
  className,
  children,
}: Readonly<{
  href: string;
  event: string;
  properties?: Record<string, unknown>;
  className?: string;
  children: ReactNode;
}>) {
  return (
    <Link href={href} className={className} onClick={() => track(event, properties)}>
      {children}
    </Link>
  );
}
