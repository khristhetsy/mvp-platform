"use client";

import { RouteSegmentError } from "@/components/route-boundaries/RouteSegmentError";

export default function RootError({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <RouteSegmentError
      error={error}
      reset={reset}
      eyebrow="CapitalOS"
      homeHref="/"
      homeLabel="Back home"
    />
  );
}
