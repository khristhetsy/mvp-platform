"use client";

import { RouteSegmentError } from "@/components/route-boundaries/RouteSegmentError";

export default function FoundersError({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <RouteSegmentError
      error={error}
      reset={reset}
      eyebrow="For founders"
      homeHref="/founders"
      homeLabel="Back to founders"
    />
  );
}
