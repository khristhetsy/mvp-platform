import type { CompanyPledgeSummary } from "@/lib/data/investor-pledges";

/**
 * Pledge / indicated-interest display ("Total pledged · From N investors").
 *
 * Hidden while crowdfunding is paused (private-placement only). Every consumer
 * (opportunity cards, deal cards, investor report view) renders nothing. Restore
 * the previous implementation to bring the block back.
 */
export function CompanyPledgeSummaryBlock(
  props: Readonly<{ summary: CompanyPledgeSummary; compact?: boolean }>,
): null {
  void props;
  return null;
}
