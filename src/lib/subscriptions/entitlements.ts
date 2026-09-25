import type { PlanType } from "@/lib/subscriptions/plans";

/**
 * Distribution entitlements per founder tier (new pricing model). Tools are free
 * for everyone (see access.ts / featuresForPlan); THIS is the paid layer:
 *
 *  - Free        sees full matched investor profiles; no distribution, no intro requests.
 *  - Basic       DIY outreach + one-pager to up to 5 matches, brokered intro requests.
 *  - Professional adds up to 50, monthly presentation slot.
 *
 * Every tier sees investor profiles (name, firm, type, stage, check size). Investor
 * contact details are never shown to founders: iCFO brokers the introduction.
 *  - Managed IR  done-for-you; everything Professional has, uncapped.
 */
export type FounderEntitlements = {
  /** Reveal investor identities (name, firm). Every tier; contact details stay hidden. */
  revealInvestorIdentities: boolean;
  /** Distribute — one-pager sends + DIY outreach (Basic and up). */
  canDistribute: boolean;
  /** Request brokered introductions (Basic and up), within founder_connection_config limits. */
  canBrokerIntros: boolean;
  /** Monthly presentation slot (Professional and up). */
  canPresentMonthly: boolean;
  /** Additional company accounts (Professional and up). */
  canAddCompany: boolean;
  /** Max matched investors distributed to. 0 = none (Free); null = uncapped (Managed IR). */
  investorCap: number | null;
};

const FREE: FounderEntitlements = {
  revealInvestorIdentities: true,
  canDistribute: false,
  canBrokerIntros: false,
  canPresentMonthly: false,
  canAddCompany: false,
  investorCap: 0,
};

const BASIC: FounderEntitlements = {
  revealInvestorIdentities: true,
  canDistribute: true,
  canBrokerIntros: true,
  canPresentMonthly: false,
  canAddCompany: false,
  investorCap: 5,
};

const PROFESSIONAL: FounderEntitlements = {
  revealInvestorIdentities: true,
  canDistribute: true,
  canBrokerIntros: true,
  canPresentMonthly: true,
  canAddCompany: true,
  investorCap: 50,
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
