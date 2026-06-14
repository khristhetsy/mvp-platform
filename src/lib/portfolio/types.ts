export type InvestmentStage =
  | "pre_seed"
  | "seed"
  | "series_a"
  | "series_b"
  | "growth"
  | "ipo"
  | "exited"
  | "written_off";

export type InvestmentSource = "deal_room" | "self_reported";
export type PortfolioStatus  = "invested" | "committed" | "tracking";

export interface PortfolioInvestment {
  id: string;
  investor_user_id: string;
  company_id: string | null;
  deal_room_id: string | null;
  company_name: string;
  sector: string | null;
  amount_invested: number;
  entry_valuation: number | null;
  current_valuation: number | null;
  stage: InvestmentStage | null;
  status: PortfolioStatus;
  source: InvestmentSource;
  company_slug: string | null;
  interest_id: string | null;
  invested_at: string;
  notes: string | null;
  val_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateInvestmentInput {
  company_id?: string | null;
  deal_room_id?: string | null;
  company_name: string;
  sector?: string | null;
  amount_invested: number;
  entry_valuation?: number | null;
  current_valuation?: number | null;
  stage?: InvestmentStage | null;
  status?: PortfolioStatus;
  company_slug?: string | null;
  interest_id?: string | null;
  invested_at: string;
  notes?: string | null;
}

export interface UpdateInvestmentInput {
  company_name?: string;
  sector?: string | null;
  amount_invested?: number;
  entry_valuation?: number | null;
  current_valuation?: number | null;
  stage?: InvestmentStage | null;
  status?: PortfolioStatus;
  invested_at?: string;
  notes?: string | null;
}

/** A pledge from investor_interests shown in the Committed tab */
export interface PledgeRecord {
  id: string;
  company_id: string | null;
  company_name: string;
  company_slug: string | null;
  pledge_amount: number | null;
  pledge_currency: string | null;
  status: string | null;
  created_at: string;
}

/** Shape returned by the admin overview endpoint — includes investor name */
export interface AdminPortfolioRow extends PortfolioInvestment {
  investor_name: string | null;
  investor_email: string | null;
}

export const STAGE_LABELS: Record<InvestmentStage, string> = {
  pre_seed:    "Pre-seed",
  seed:        "Seed",
  series_a:    "Series A",
  series_b:    "Series B",
  growth:      "Growth",
  ipo:         "IPO",
  exited:      "Exited",
  written_off: "Written off",
};

/** Days before a self-reported valuation is considered stale */
export const STALE_VAL_DAYS = 90;
