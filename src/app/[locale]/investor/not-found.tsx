import { RouteSegmentNotFound } from "@/components/route-boundaries/RouteSegmentNotFound";

export default function InvestorNotFound() {
  return (
    <RouteSegmentNotFound
      eyebrow="Investor workspace"
      homeHref="/investor/dashboard"
      homeLabel="Back to dashboard"
      secondaryHref="/investor/opportunities"
      secondaryLabel="Browse opportunities"
    />
  );
}
