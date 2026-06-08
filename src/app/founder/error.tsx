"use client";

import { RouteSegmentError } from "@/components/route-boundaries/RouteSegmentError";

export default function FounderError({
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
      eyebrow="Founder workspace"
      homeHref="/founder/dashboard"
      homeLabel="Back to dashboard"
    />
  );
}
