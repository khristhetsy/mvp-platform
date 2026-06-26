import { RouteSegmentNotFound } from "@/components/route-boundaries/RouteSegmentNotFound";

export default function RootNotFound() {
  return (
    <RouteSegmentNotFound
      eyebrow="CapitalOS"
      title="Page not found"
      description="The page you're looking for doesn't exist or has moved."
      homeHref="/"
      homeLabel="Back home"
    />
  );
}
