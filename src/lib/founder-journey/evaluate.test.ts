import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { evaluateFounderJourney } from "./evaluate";

type TableResult = { data: unknown };

/**
 * Minimal chainable Supabase mock. Each table resolves to a fixed result for
 * both terminal methods (.maybeSingle/.single) and direct await (.then), which
 * is all evaluateFounderJourney needs.
 */
function makeSupabase(results: Record<string, TableResult>): SupabaseClient<Database> {
  const from = (table: string) => {
    const result = results[table] ?? { data: null };
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    chain.select = self;
    chain.eq = self;
    chain.order = self;
    chain.limit = self;
    chain.maybeSingle = async () => result;
    chain.single = async () => result;
    chain.then = (onFulfilled: (value: TableResult) => unknown) =>
      Promise.resolve(result).then(onFulfilled);
    return chain;
  };
  return { from } as unknown as SupabaseClient<Database>;
}

// All eight tracked document types — a fully-documented founder, so the
// computed readiness score is at its maximum and unambiguously clears 75.
const ALL_DOC_TYPES = [
  "PITCH_DECK",
  "FINANCIAL_STATEMENTS",
  "CAP_TABLE",
  "BUSINESS_PLAN",
  "LEGAL_DOCUMENTS",
  "CORPORATE_DOCUMENTS",
  "CUSTOMER_CONTRACTS",
  "MARKET_RESEARCH",
].map((document_type) => ({ document_type }));

function baseTables(overrides: Record<string, TableResult> = {}): Record<string, TableResult> {
  return {
    profiles: { data: { journey_stage: "qualify", stage_approval_status: null, stage_feedback: null } },
    companies: { data: { id: "co_1", onboarding_progress_percent: 100 } },
    diligence_reports: { data: { readiness_score: null } },
    documents: { data: ALL_DOC_TYPES },
    deal_rooms: { data: null },
    investor_interests: { data: null },
    ...overrides,
  };
}

describe("evaluateFounderJourney", () => {
  it("allows approval in qualify when docs + computed readiness clear the bar", async () => {
    const supabase = makeSupabase(baseTables());
    const state = await evaluateFounderJourney(supabase, "founder_1");

    expect(state.stage).toBe("qualify");
    expect(state.conditions.requiredDocsUploaded).toBe(true);
    expect(state.conditions.readinessQualified).toBe(true);
    expect(state.canRequestApproval).toBe(true);
  });

  it("falls back to the computed readiness score when no diligence score exists", async () => {
    // diligence readiness_score is null — the gate must still see a real number.
    const supabase = makeSupabase(baseTables());
    const state = await evaluateFounderJourney(supabase, "founder_1");

    expect(state.conditions.readinessScore).not.toBeNull();
    expect(state.conditions.readinessScore!).toBeGreaterThanOrEqual(75);
  });

  it("prefers an admin-set diligence score over the computed one", async () => {
    const supabase = makeSupabase(
      baseTables({
        diligence_reports: { data: { readiness_score: 82 } },
        documents: { data: [{ document_type: "PITCH_DECK" }] },
      }),
    );
    const state = await evaluateFounderJourney(supabase, "founder_1");

    expect(state.conditions.readinessScore).toBe(82);
    expect(state.conditions.readinessQualified).toBe(true);
  });

  it("matches required docs case-insensitively and via the FINANCIALS alias", async () => {
    const supabase = makeSupabase(
      baseTables({
        documents: {
          data: [
            { document_type: "pitch_deck" },
            { document_type: "financials" },
            { document_type: "cap_table" },
            { document_type: "MARKET_RESEARCH" },
            { document_type: "LEGAL_DOCUMENTS" },
            { document_type: "BUSINESS_PLAN" },
          ],
        },
      }),
    );
    const state = await evaluateFounderJourney(supabase, "founder_1");

    expect(state.conditions.requiredDocsUploaded).toBe(true);
  });

  it("blocks approval when a required doc is missing", async () => {
    const supabase = makeSupabase(
      baseTables({
        documents: {
          data: [
            { document_type: "PITCH_DECK" },
            { document_type: "FINANCIAL_STATEMENTS" },
            { document_type: "MARKET_RESEARCH" },
            { document_type: "LEGAL_DOCUMENTS" },
            { document_type: "BUSINESS_PLAN" },
            { document_type: "CORPORATE_DOCUMENTS" },
          ],
        },
      }),
    );
    const state = await evaluateFounderJourney(supabase, "founder_1");

    expect(state.conditions.requiredDocsUploaded).toBe(false);
    expect(state.canRequestApproval).toBe(false);
  });

  it("reports a pending review and disallows re-submission", async () => {
    const supabase = makeSupabase(
      baseTables({
        profiles: {
          data: { journey_stage: "qualify", stage_approval_status: "pending", stage_feedback: null },
        },
      }),
    );
    const state = await evaluateFounderJourney(supabase, "founder_1");

    expect(state.pendingApproval).toBe(true);
    expect(state.canRequestApproval).toBe(false);
  });

  it("reads the persisted stage and surfaces rejection feedback", async () => {
    const supabase = makeSupabase(
      baseTables({
        profiles: {
          data: { journey_stage: "deploy", stage_approval_status: "approved", stage_feedback: null },
        },
      }),
    );
    const state = await evaluateFounderJourney(supabase, "founder_1");

    expect(state.stage).toBe("deploy");
    expect(state.stageIndex).toBe(2);
  });
});
