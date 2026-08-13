import type { PlanType } from "@/lib/subscriptions/plans";

/**
 * Distribution entitlements per founder tier (new pricing model). Tools are free
 * for everyone (see access.ts / featuresForPlan); THIS is the paid layer:
 *
 *  - Free        sees that matches exist (count/sector/tier) but not WHO; no distribution.
 *  - Basic       reveals identities, DIY outreach + one-pager to up to 25 matches.
 *  - Professional adds up to 100, monthly presentation slot, brokered intros, add-company.
 *  - Managed IR  done-for-you; everything Professional has, uncapped.
 */
export type FounderEntitlements = {
  /** Reveal investor identities. Free = false (count/sector/tier only). */
  revealInvestorIdentities: boolean;
  /** Distribute — one-pager sends + DIY outreach (Basic and up). */
  canDistribute: boolean;
  /** Request brokered introductions (Professional and up). */
  canBrokerIntros: boolean;
  /** Monthly presentation slot (Professional and up). */
  canPresentMonthly: boolean;
  /** Additional company accounts (Professional and up). */
  canAddCompany: boolean;
  /** Max matched investors distributed to. 0 = none (Free); null = uncapped (Managed IR). */
  investorCap: number | null;
};

const FREE: FounderEntitlements = {
  revealInvestorIdentities: false,
  canDistribute: false,
  canBrokerIntros: false,
  canPresentMonthly: false,
  canAddCompany: false,
  investorCap: 0,
};

const BASIC: FounderEntitlements = {
  revealInvestorIdentities: true,
  canDistribute: true,
  canBrokerIntros: false,
  canPresentMonthly: false,
  canAddCompany: false,
  investorCap: 25,
};

const PROFESSIONAL: FounderEntitlements = {
  revealInvestorIdentities: true,
  canDistribute: true,
  canBrokerIntros: true,
  canPresentMonthly: true,
  canAddCompany: true,
  investorCap: 100,
};

const MANAGED_IR: FounderEntitlements = { ...PROFESSIONAL, investorCap: null };

/** Distribution entitlements for a founder plan. Unknown / Free / legacy trial → Free. */
export function founderEntitlements(plan: PlanType | null | undefined): FounderEntitlements {
  switch (plan) {
    case "founder_basic":
      return BASIC;
    case "founder_professional":
      return PROFESSIONAL;
    case "founder_managed_ir":
    case "admin_internal":
      return MANAGED_IR;
    default:
      // founder_free, founder_trial (grandfathered), investor_*, null
      return FREE;
  }
}
