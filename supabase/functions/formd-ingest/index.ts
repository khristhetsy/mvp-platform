// SEC Form D — daily ingest Edge Function (build spec §4). Deno runtime.
//
// SETUP (one-time): the runtime-agnostic domain logic lives in src/lib/formd/*.
// Supabase's Deno needs those files importable from here. Either:
//   (a) vendor a copy into supabase/functions/_shared/formd/ with ".ts" import
//       extensions, or (b) add a bundle step. The imports below assume (a).
//
// ENV required (function fails fast without SEC_USER_AGENT — §4.4/§13.5):
//   SEC_USER_AGENT   e.g. "iCFO Capital Global data@icfocapital.com"
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (service role; NO contacts grant)
//
// Schedule with pg_cron: 0 7 * * 1-5 (09:00 CET weekdays) — see cron.sql.

// deno-lint-ignore-file
import { createClient } from "npm:@supabase/supabase-js@2";
import { ingestDay, requireUserAgent } from "../_shared/formd/ingest.ts";
import type { FormDFiling } from "../_shared/formd/types.ts";

Deno.serve(async (req: Request) => {
  const env = Deno.env.toObject();
  let userAgent: string;
  try {
    userAgent = requireUserAgent(env); // aborts at startup if unset
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }

  const supabase = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!);

  // Which day: ?date=YYYY-MM-DD, else yesterday (EDGAR posts the prior day).
  const url = new URL(req.url);
  const dateParam = url.searchParams.get("date");
  const date = dateParam ? new Date(`${dateParam}T00:00:00Z`) : new Date(Date.now() - 86_400_000);

  const upsert = async (f: FormDFiling & { formdScore: number; scoreNotes: string; derivedFundingStage: string | null; derivedInvestorType: string | null }) => {
    const row = {
      accession_no: f.accessionNo, cik: f.cik, form_type: f.formType, is_amendment: f.isAmendment,
      date_filed: f.dateFiled, company_name: f.companyName, phone: f.phone,
      street1: f.street1, street2: f.street2, city: f.city, state: f.state, zip_code: f.zipCode,
      entity_type: f.entityType, jurisdiction: f.jurisdiction, year_of_inc: f.yearOfInc,
      industry: f.industry, is_fund: f.isFund, revenue_range: f.revenueRange, exemptions: f.exemptions, is_506c: f.is506c,
      total_offering: f.totalOffering, total_sold: f.totalSold, total_remaining: f.totalRemaining,
      pct_sold: f.pctSold, min_investment: f.minInvestment, investor_count: f.investorCount,
      date_first_sale: f.dateFirstSale, sale_yet_to_occur: f.saleYetToOccur, days_since_first_sale: f.daysSinceFirstSale,
      has_placement_agent: f.hasPlacementAgent, placement_agents: f.placementAgents, sales_commission: f.salesCommission,
      signer_name: f.signerName, signer_title: f.signerTitle,
      formd_score: f.formdScore, score_notes: f.scoreNotes,
      derived_funding_stage: f.derivedFundingStage, derived_investor_type: f.derivedInvestorType,
      filing_url: f.filingUrl, updated_at: new Date().toISOString(),
    };
    await supabase.from("formd_filings").upsert(row, { onConflict: "accession_no" });

    // Related persons: replace for this accession (idempotent). Street NOT stored.
    await supabase.from("formd_related_persons").delete().eq("accession_no", f.accessionNo);
    if (f.relatedPersons.length) {
      await supabase.from("formd_related_persons").insert(
        f.relatedPersons.map((p) => ({
          accession_no: f.accessionNo, first_name: p.firstName, middle_name: p.middleName, last_name: p.lastName,
          full_name: p.fullName, relationships: p.relationships, city: p.city, state: p.state, is_signer: p.isSigner,
        })),
      );
    }
  };

  const fetchImpl = async (u: string, init: { headers: Record<string, string> }) => {
    const res = await fetch(u, init);
    return { status: res.status, text: await res.text() };
  };

  const result = await ingestDay(date, { fetchImpl, userAgent, upsert, reqPerSec: 7 });
  return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
});
