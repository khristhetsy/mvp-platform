import { RouteSegmentNotFound } from "@/components/route-boundaries/RouteSegmentNotFound";

export default function FounderNotFound() {
  return (
    <RouteSegmentNotFound
      eyebrow="Founder workspace"
      homeHref="/founder/dashboard"
      homeLabel="Back to dashboard"
      secondaryHref="/founder/actions"
      secondaryLabel="View actions"
    />
  );
}
