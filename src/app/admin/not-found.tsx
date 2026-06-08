import { RouteSegmentNotFound } from "@/components/route-boundaries/RouteSegmentNotFound";

export default function AdminNotFound() {
  return (
    <RouteSegmentNotFound
      eyebrow="Admin workspace"
      homeHref="/admin/dashboard"
      homeLabel="Back to dashboard"
      secondaryHref="/admin/actions"
      secondaryLabel="View actions"
    />
  );
}
