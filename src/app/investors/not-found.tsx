import { RouteSegmentNotFound } from "@/components/route-boundaries/RouteSegmentNotFound";

export default function InvestorsNotFound() {
  return (
    <RouteSegmentNotFound
      eyebrow="For investors"
      title="Page not found"
      description="This page may have moved. Explore how investors discover capital-ready companies on iCapOS."
      homeHref="/investors"
      homeLabel="Back to investors"
    />
  );
}
