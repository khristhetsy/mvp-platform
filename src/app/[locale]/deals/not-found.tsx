import { RouteSegmentNotFound } from "@/components/route-boundaries/RouteSegmentNotFound";

export default function DealsNotFound() {
  return (
    <RouteSegmentNotFound
      eyebrow="Investor marketplace"
      title="Opportunity not found"
      description="This listing may have been removed or is not yet published. Browse the marketplace for available opportunities."
      homeHref="/deals"
      homeLabel="Back to marketplace"
    />
  );
}
