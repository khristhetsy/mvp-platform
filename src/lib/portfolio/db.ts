import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type {
  PortfolioInvestment,
  CreateInvestmentInput,
  UpdateInvestmentInput,
  AdminPortfolioRow,
  PledgeRecord,
} from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function portfolioDb(): Promise<any> {
  return createServerSupabaseClient();
}

/** List investments for the current user (RLS applies). */
export async function listInvestments(): Promise<PortfolioInvestment[]> {
  const db = await portfolioDb();
  const { data, error } = await db
    .from("portfolio_investments")
    .select("*")
    .order("invested_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: PortfolioInvestment) => ({
    ...r,
    status:       r.status ?? "invested",
    company_slug: r.company_slug ?? null,
    interest_id:  r.interest_id ?? null,
  })) as PortfolioInvestment[];
}

/** Create a new investment for the current user. */
export async function createInvestment(
  userId: string,
  input: CreateInvestmentInput,
): Promise<PortfolioInvestment> {
  const db = await portfolioDb();
  const source = input.deal_room_id ? "deal_room" : "self_reported";
  const { data, error } = await db
    .from("portfolio_investments")
    .insert({
      investor_user_id:  userId,
      company_id:        input.company_id ?? null,
      deal_room_id:      input.deal_room_id ?? null,
      company_name:      input.company_name,
      sector:            input.sector ?? null,
      amount_invested:   input.amount_invested,
      entry_valuation:   input.entry_valuation ?? null,
      current_valuation: input.current_valuation ?? null,
      stage:             input.stage ?? null,
      status:            input.status ?? "invested",
      company_slug:      input.company_slug ?? null,
      interest_id:       input.interest_id ?? null,
      source,
      invested_at:       input.invested_at,
      notes:             input.notes ?? null,
      val_updated_at:    input.current_valuation ? new Date().toISOString() : null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as PortfolioInvestment;
}

/** Update an investment — only the owner or admin can do this (enforced by RLS). */
export async function updateInvestment(
  id: string,
  input: UpdateInvestmentInput,
): Promise<PortfolioInvestment> {
  const db = await portfolioDb();
  const patch: Record<string, unknown> = {};
  if (input.company_name      !== undefined) patch.company_name      = input.company_name;
  if (input.sector             !== undefined) patch.sector             = input.sector;
  if (input.amount_invested    !== undefined) patch.amount_invested    = input.amount_invested;
  if (input.entry_valuation    !== undefined) patch.entry_valuation    = input.entry_valuation;
  if (input.current_valuation  !== undefined) {
    patch.current_valuation = input.current_valuation;
    patch.val_updated_at    = new Date().toISOString();
  }
  if (input.stage              !== undefined) patch.stage              = input.stage;
  if (input.status             !== undefined) patch.status             = input.status;
  if (input.invested_at        !== undefined) patch.invested_at        = input.invested_at;
  if (input.notes              !== undefined) patch.notes              = input.notes;

  const { data, error } = await db
    .from("portfolio_investments")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as PortfolioInvestment;
}

/** Delete an investment. */
export async function deleteInvestment(id: string): Promise<void> {
  const db = await portfolioDb();
  const { error } = await db.from("portfolio_investments").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** List investor's pledges from investor_interests (for Committed tab). */
export async function listPledges(userId: string): Promise<PledgeRecord[]> {
  const db = await portfolioDb();
  const { data, error } = await db
    .from("investor_interests")
    .select("id, company_id, pledge_amount, pledge_currency, status, created_at, companies(company_name, slug)")
    .eq("investor_id", userId)
    .not("pledge_amount", "is", null)
    .order("created_at", { ascending: false });
  if (error) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    id:               r.id,
    company_id:       r.company_id ?? null,
    company_name:     r.companies?.company_name ?? "Unknown company",
    company_slug:     r.companies?.slug ?? null,
    pledge_amount:    r.pledge_amount,
    pledge_currency:  r.pledge_currency ?? "USD",
    status:           r.status ?? null,
    created_at:       r.created_at,
  })) as PledgeRecord[];
}

/** Admin: list ALL investments with investor name + email (service role). */
export async function listAllInvestmentsAdmin(): Promise<AdminPortfolioRow[]> {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("portfolio_investments")
    .select("*, profiles!portfolio_investments_investor_user_id_fkey(full_name, email)")
    .order("invested_at", { ascending: false })
    .limit(500);

  if (error) {
    const { data: plain, error: e2 } = await admin
      .from("portfolio_investments")
      .select("*")
      .order("invested_at", { ascending: false })
      .limit(500);
    if (e2) throw new Error(e2.message);
    return (plain ?? []).map((r: PortfolioInvestment) => ({
      ...r,
      investor_name:  null,
      investor_email: null,
    })) as AdminPortfolioRow[];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    ...r,
    investor_name:  r.profiles?.full_name ?? null,
    investor_email: r.profiles?.email     ?? null,
    profiles:       undefined,
  })) as AdminPortfolioRow[];
}
