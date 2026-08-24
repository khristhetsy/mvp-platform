// SEC Form D — nightly recompute Edge Function (build spec §4.7). Deno runtime.
// Refreshes days_since_first_sale and re-scores UNPROMOTED filings so leads aging
// into the stall window surface without a new filing arriving.
// Schedule: 0 3 * * * (see cron.sql). Same _shared/formd setup as formd-ingest.

// deno-lint-ignore-file
import { createClient } from "npm:@supabase/supabase-js@2";
import { recomputeUnpromoted } from "../_shared/formd/ingest.ts";
import type { FormDFiling } from "../_shared/formd/types.ts";

Deno.serve(async () => {
  const env = Deno.env.toObject();
  const supabase = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!);

  const loadUnpromoted = async (): Promise<FormDFiling[]> => {
    const { data } = await supabase
      .from("formd_filings")
      .select("*, formd_related_persons(*)")
      .is("promoted_contact_id", null);
    return (data ?? []).map((r: Record<string, unknown>) => ({
      accessionNo: String(r.accession_no), cik: String(r.cik), formType: String(r.form_type), isAmendment: Boolean(r.is_amendment),
      dateFiled: (r.date_filed as string) ?? null, companyName: String(r.company_name), phone: (r.phone as string) ?? null,
      street1: null, street2: null, city: (r.city as string) ?? null, state: (r.state as string) ?? null, zipCode: null,
      entityType: (r.entity_type as string) ?? null, jurisdiction: (r.jurisdiction as string) ?? null, yearOfInc: (r.year_of_inc as string) ?? null,
      industry: (r.industry as string) ?? null, isFund: Boolean(r.is_fund), revenueRange: (r.revenue_range as string) ?? null,
      exemptions: (r.exemptions as string) ?? null, is506c: Boolean(r.is_506c),
      totalOffering: (r.total_offering as number) ?? null, totalSold: (r.total_sold as number) ?? null, totalRemaining: (r.total_remaining as number) ?? null,
      pctSold: (r.pct_sold as number) ?? null, minInvestment: (r.min_investment as number) ?? null, investorCount: (r.investor_count as number) ?? null,
      dateFirstSale: (r.date_first_sale as string) ?? null, saleYetToOccur: Boolean(r.sale_yet_to_occur), daysSinceFirstSale: (r.days_since_first_sale as number) ?? null,
      hasPlacementAgent: Boolean(r.has_placement_agent), placementAgents: (r.placement_agents as string) ?? null, salesCommission: (r.sales_commission as number) ?? null,
      signerName: (r.signer_name as string) ?? null, signerTitle: (r.signer_title as string) ?? null,
      relatedPersons: ((r.formd_related_persons as Array<Record<string, unknown>>) ?? []).map((p) => ({
        firstName: (p.first_name as string) ?? null, middleName: (p.middle_name as string) ?? null, lastName: (p.last_name as string) ?? null,
        fullName: String(p.full_name), relationships: (p.relationships as string) ?? null, city: (p.city as string) ?? null, state: (p.state as string) ?? null,
        isSigner: Boolean(p.is_signer),
      })),
      filingUrl: (r.filing_url as string) ?? null,
    }));
  };

  const update = async (accessionNo: string, patch: { daysSinceFirstSale: number | null; formdScore: number; scoreNotes: string; derivedFundingStage: string | null; derivedInvestorType: string | null }) => {
    await supabase.from("formd_filings").update({
      days_since_first_sale: patch.daysSinceFirstSale,
      formd_score: patch.formdScore,
      score_notes: patch.scoreNotes,
      derived_funding_stage: patch.derivedFundingStage,
      derived_investor_type: patch.derivedInvestorType,
      updated_at: new Date().toISOString(),
    }).eq("accession_no", accessionNo);
  };

  const result = await recomputeUnpromoted({ loadUnpromoted, update });
  return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
});
