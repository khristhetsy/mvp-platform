import { RouteSegmentNotFound } from "@/components/route-boundaries/RouteSegmentNotFound";

export default function CampaignsNotFound() {
  return (
    <RouteSegmentNotFound
      eyebrow="Campaigns"
      title="Campaign not found"
      description="This campaign may have moved to the marketplace or is no longer available."
      homeHref="/deals"
      homeLabel="Back to marketplace"
    />
  );
}
