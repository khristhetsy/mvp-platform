import { RouteSegmentNotFound } from "@/components/route-boundaries/RouteSegmentNotFound";

export default function FoundersNotFound() {
  return (
    <RouteSegmentNotFound
      eyebrow="For founders"
      title="Page not found"
      description="This page may have moved. Explore how CapitalOS helps founders become capital-ready."
      homeHref="/founders"
      homeLabel="Back to founders"
    />
  );
}
