"use client";

import { RouteSegmentError } from "@/components/route-boundaries/RouteSegmentError";

export default function CampaignsError({
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
      eyebrow="Campaigns"
      homeHref="/deals"
      homeLabel="Back to marketplace"
    />
  );
}
