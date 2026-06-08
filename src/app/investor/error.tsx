"use client";

import { RouteSegmentError } from "@/components/route-boundaries/RouteSegmentError";

export default function InvestorError({
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
      eyebrow="Investor workspace"
      homeHref="/investor/dashboard"
      homeLabel="Back to dashboard"
    />
  );
}
