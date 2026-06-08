"use client";

import { RouteSegmentError } from "@/components/route-boundaries/RouteSegmentError";

export default function AdminError({
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
      eyebrow="Admin workspace"
      homeHref="/admin/dashboard"
      homeLabel="Back to dashboard"
    />
  );
}
