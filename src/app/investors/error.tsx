"use client";

import { RouteSegmentError } from "@/components/route-boundaries/RouteSegmentError";

export default function InvestorsError({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <RouteSegmentError
      error={error}
      reset={reset}
      eyebrow="For investors"
      homeHref="/investors"
      homeLabel="Back to investors"
    />
  );
}
