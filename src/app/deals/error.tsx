"use client";

import { RouteSegmentError } from "@/components/route-boundaries/RouteSegmentError";

export default function DealsError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  return (
    <RouteSegmentError
      error={error}
      reset={reset}
      eyebrow="Investor marketplace"
      homeHref="/deals"
      homeLabel="Back to marketplace"
    />
  );
}
