export type HolderGroup = "founder" | "pool" | "investor";

export interface Holder {
  id: string;
  name: string;
  group: HolderGroup;
  shareClass: string; // e.g. "Common", "Options", "Preferred Seed", "SAFE"
  shares: number;
}

export interface RoundModel {
  newInvestment: number; // new money raised
  preMoney: number; // pre-money valuation
}

export interface CapTable {
  holders: Holder[];
  round: RoundModel | null;
  updatedAt: string | null;
}
