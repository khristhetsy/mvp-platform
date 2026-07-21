import {
  notifyFounderSpvOpened,
  notifyInvestorSpvInvited,
  notifyInvestorSpvStatusChanged,
  notifyStaffSpvInterest,
} from "@/lib/spv/notify";
import type {
  SpvOpportunityRecord,
  SpvOpportunityStatus,
  SpvParticipationRecord,
  SpvParticipationStatus,
} from "@/lib/spv/types";
import { recordInvestorCrmActivity } from "@/lib/data/investor-crm";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { assertSpvCanClose, seedSpvChecklistItems } from "@/lib/spv/checklist";
import {
  assertParticipationCanComplete,
  seedSpvParticipationRequirements,
} from "@/lib/spv/participation-requirements";
import { formatSpvCurrency, getSpvParticipationTotals } from "@/lib/spv/display";

export { formatSpvCurrency, getSpvParticipationTotals };

export async function listAdminSpvOpportunities(admin: SupabaseClient<Database>) {
  const { data, error } = await admin
    .from("spv_opportunities")
    .select("*, companies(company_name, slug)")
    .order("updated_at", { ascending: false });

  if (error) {
    return { error };
  }

  return { data: (data ?? []) as SpvOpportunityRecord[] };
}

export async function listSpvParticipationsForOpportunity(
  admin: SupabaseClient<Database>,
  spvOpportunityId: string,
) {
  const { data, error } = await admin
    .from("spv_participations")
    .select("*, profiles:investor_id(full_name, email)")
    .eq("spv_opportunity_id", spvOpportunityId)
    .order("updated_at", { ascending: false });

  if (error) {
    return { error };
  }

  return { data: (data ?? []) as SpvParticipationRecord[] };
}

export async function createSpvOpportunity(
  admin: SupabaseClient<Database>,
  input: {
    companyId: string;
    createdBy: string;
    name: string;
    targetAmount?: number | null;
    minimumCommitment?: number | null;
    description?: string | null;
    termsSummary?: string | null;
    status?: SpvOpportunityStatus;
  },
) {
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("spv_opportunities")
    .insert({
      company_id: input.companyId,
      created_by: input.createdBy,
      name: input.name.trim(),
      target_amount: input.targetAmount ?? null,
      minimum_commitment: input.minimumCommitment ?? null,
      description: input.description?.trim() ?? null,
      terms_summary: input.termsSummary?.trim() ?? null,
      status: input.status ?? "draft",
      updated_at: now,
    })
    .select("*, companies(company_name, slug)")
    .single();

  if (error || !data) {
    return { error: error ?? new Error("Unable to create SPV opportunity.") };
  }

  const record = data as SpvOpportunityRecord;
  // Awaited, not fire-and-forget: on Vercel the function can return before a
  // floating promise resolves, dropping the write. An SPV with no checklist
  // can never be closed (assertSpvCanClose treats an empty checklist as a hard
  // block), so a dropped seed strands the opportunity.
  const seedResult = await seedSpvChecklistItems(admin, record.id);
  if (seedResult && "error" in seedResult && seedResult.error) {
    return { error: new Error(`SPV created but checklist seeding failed: ${seedResult.error.message}`) };
  }

  return { data: record };
}

export async function updateSpvOpportunityStatus(
  admin: SupabaseClient<Database>,
  input: {
    spvOpportunityId: string;
    status: SpvOpportunityStatus;
    actorId: string;
  },
) {
  const { data: previous } = await admin
    .from("spv_opportunities")
    .select("*, companies(company_name)")
    .eq("id", input.spvOpportunityId)
    .single();

  if (input.status === "closed") {
    const closeCheck = await assertSpvCanClose(admin, input.spvOpportunityId);
    if (closeCheck.error) {
      return { error: closeCheck.error };
    }
  }

  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("spv_opportunities")
    .update({ status: input.status, updated_at: now })
    .eq("id", input.spvOpportunityId)
    .select("*, companies(company_name, slug)")
    .single();

  if (error || !data) {
    return { error: error ?? new Error("Unable to update SPV opportunity.") };
  }

  const record = data as SpvOpportunityRecord;
  const companyName =
    (Array.isArray(record.companies) ? record.companies[0] : record.companies)?.company_name ??
    "Company";

  if (input.status === "open" && previous?.status !== "open") {
    void notifyFounderSpvOpened({
      companyId: record.company_id,
      spvName: record.name,
      actorId: input.actorId,
    });

    const { data: participations } = await listSpvParticipationsForOpportunity(admin, record.id);
    for (const row of participations ?? []) {
      void notifyInvestorSpvInvited({
        investorId: row.investor_id,
        spvOpportunityId: record.id,
        spvName: record.name,
        companyName,
        actorId: input.actorId,
      });
    }
  }

  const { refreshSpvOperationalReadiness } = await import("@/lib/spv/sync-readiness");
  await refreshSpvOperationalReadiness(admin, input.spvOpportunityId, { actorId: input.actorId });

  return { data: record };
}

export async function seedSpvParticipationsFromInterests(
  admin: SupabaseClient<Database>,
  spvOpportunityId: string,
  actorId: string,
) {
  const { data: spv, error: spvError } = await admin
    .from("spv_opportunities")
    .select("*, companies(company_name)")
    .eq("id", spvOpportunityId)
    .single();

  if (spvError || !spv) {
    return { error: spvError ?? new Error("SPV opportunity not found.") };
  }

  const { data: interests } = await admin
    .from("investor_interests")
    .select("investor_id, pledge_amount, interest_amount")
    .eq("company_id", spv.company_id);

  const companyName = (spv.companies as { company_name?: string } | null)?.company_name ?? "Company";
  let created = 0;

  for (const row of interests ?? []) {
    const indicative =
      row.pledge_amount != null && Number(row.pledge_amount) > 0
        ? Number(row.pledge_amount)
        : row.interest_amount != null
          ? Number(row.interest_amount)
          : null;

    const { data: participation, error: insertError } = await admin
      .from("spv_participations")
      .upsert(
        {
          spv_opportunity_id: spvOpportunityId,
          investor_id: row.investor_id,
          company_id: spv.company_id,
          indicative_amount: indicative,
          status: "invited",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "spv_opportunity_id,investor_id" },
      )
      .select("id")
      .single();

    if (!insertError && participation?.id) {
      created += 1;
      // Awaited: this write establishes the investor's document requirements. If
      // the function returns before it lands, the investor sees an empty
      // checklist. The seed is idempotent, so a retry of the whole invite is safe.
      const seed = await seedSpvParticipationRequirements(admin, {
        spvParticipationId: participation.id,
        spvOpportunityId,
        investorId: row.investor_id,
        spvName: spv.name,
        notifyInvestor: spv.status === "open",
        actorId,
      });
      if (seed && "error" in seed && seed.error) {
        console.error(
          `[spv] failed to seed requirements for participation ${participation.id}: ${seed.error.message}`,
        );
      }
      if (spv.status === "open") {
        void notifyInvestorSpvInvited({
          investorId: row.investor_id,
          spvOpportunityId,
          spvName: spv.name,
          companyName,
          actorId,
        });
      }
    }
  }

  const { refreshSpvOperationalReadiness } = await import("@/lib/spv/sync-readiness");
  await refreshSpvOperationalReadiness(admin, spvOpportunityId, { actorId });

  return { created };
}

export async function listFounderSpvSummary(
  supabase: SupabaseClient<Database>,
  companyId: string,
) {
  const { data: opportunities, error } = await supabase
    .from("spv_opportunities")
    .select("*")
    .eq("company_id", companyId)
    .order("updated_at", { ascending: false });

  if (error) {
    return { error, opportunities: [], participations: [] as SpvParticipationRecord[] };
  }

  const opps = (opportunities ?? []) as SpvOpportunityRecord[];
  if (opps.length === 0) {
    return { opportunities: [], participations: [] };
  }

  const ids = opps.map((o) => o.id);
  const { data: participations } = await supabase
    .from("spv_participations")
    .select("id, spv_opportunity_id, indicative_amount, status, created_at")
    .in("spv_opportunity_id", ids);

  return {
    opportunities: opps,
    participations: (participations ?? []) as SpvParticipationRecord[],
  };
}

export async function loadInvestorSpvWorkspace(
  supabase: SupabaseClient<Database>,
  investorId: string,
) {
  const [openOpps, participations] = await Promise.all([
    supabase
      .from("spv_opportunities")
      .select(
        "*, companies(company_name, slug)",
      )
      .eq("status", "open")
      .order("updated_at", { ascending: false }),
    supabase
      .from("spv_participations")
      .select(
        "*, spv_opportunities(name, status, target_amount, minimum_commitment, description, terms_summary, checklist_readiness_pct, document_ready_at, investor_package_status, investor_closing_status), companies(company_name, slug)",
      )
      .eq("investor_id", investorId)
      .order("updated_at", { ascending: false }),
  ]);

  type ParticipationWithSpv = SpvParticipationRecord & {
    spv_opportunities?: SpvOpportunityRecord | SpvOpportunityRecord[] | null;
    companies?: { company_name: string; slug: string | null } | { company_name: string; slug: string | null }[] | null;
  };

  const myParticipations = (participations.data ?? []) as unknown as ParticipationWithSpv[];

  const participatingSpvIds = new Set(myParticipations.map((p) => p.spv_opportunity_id));
  const openNotJoined = ((openOpps.data ?? []) as unknown as SpvOpportunityRecord[]).filter(
    (o) => !participatingSpvIds.has(o.id),
  );

  return {
    openOpportunities: openNotJoined,
    participations: myParticipations,
  };
}

export async function upsertInvestorSpvParticipation(
  supabase: SupabaseClient<Database>,
  input: {
    investorId: string;
    spvOpportunityId: string;
    indicativeAmount?: number | null;
    status?: SpvParticipationStatus;
    notes?: string | null;
  },
) {
  const { data: spv, error: spvError } = await supabase
    .from("spv_opportunities")
    .select("id, company_id, name, status, minimum_commitment, companies(company_name)")
    .eq("id", input.spvOpportunityId)
    .single();

  if (spvError || !spv) {
    return { error: spvError ?? new Error("SPV opportunity not found.") };
  }

  if (spv.status !== "open") {
    return { error: new Error("This SPV opportunity is not open for participation.") };
  }

  const min = spv.minimum_commitment != null ? Number(spv.minimum_commitment) : null;
  if (min != null && input.indicativeAmount != null && input.indicativeAmount > 0 && input.indicativeAmount < min) {
    return { error: new Error(`Minimum indicative commitment is ${formatSpvCurrency(min)}.`) };
  }

  const status: SpvParticipationStatus =
    input.status ??
    (input.indicativeAmount != null && input.indicativeAmount > 0 ? "soft_committed" : "interested");

  if (status === "completed") {
    const { data: existingPart } = await supabase
      .from("spv_participations")
      .select("id")
      .eq("spv_opportunity_id", input.spvOpportunityId)
      .eq("investor_id", input.investorId)
      .maybeSingle();

    if (existingPart?.id) {
      const admin = createServiceRoleClient();
      const check = await assertParticipationCanComplete(admin, existingPart.id);
      if (check.error) {
        return { error: check.error };
      }
    }
  }

  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from("spv_participations")
    .select("id, status")
    .eq("spv_opportunity_id", input.spvOpportunityId)
    .eq("investor_id", input.investorId)
    .maybeSingle();

  const updatePayload: Database["public"]["Tables"]["spv_participations"]["Update"] = {
    indicative_amount: input.indicativeAmount ?? null,
    status,
    notes: input.notes?.trim() ?? null,
    updated_at: now,
  };

  const insertPayload: Database["public"]["Tables"]["spv_participations"]["Insert"] = {
    spv_opportunity_id: input.spvOpportunityId,
    investor_id: input.investorId,
    company_id: spv.company_id,
    indicative_amount: input.indicativeAmount ?? null,
    status,
    notes: input.notes?.trim() ?? null,
    updated_at: now,
  };

  const result = existing?.id
    ? await supabase
        .from("spv_participations")
        .update(updatePayload)
        .eq("id", existing.id)
        .select("*")
        .single()
    : await supabase.from("spv_participations").insert(insertPayload).select("*").single();

  if (result.error || !result.data) {
    return { error: result.error ?? new Error("Unable to save SPV participation.") };
  }

  const participation = result.data as SpvParticipationRecord;

  if (!existing?.id) {
    const admin = createServiceRoleClient();
    // Awaited: the investor's requirement checklist must exist before we report
    // the participation saved. Idempotent, so retrying the whole call is safe.
    const seed = await seedSpvParticipationRequirements(admin, {
      spvParticipationId: participation.id,
      spvOpportunityId: input.spvOpportunityId,
      investorId: input.investorId,
      spvName: spv.name,
      actorId: input.investorId,
    });
    if (seed && "error" in seed && seed.error) {
      console.error(
        `[spv] failed to seed requirements for participation ${participation.id}: ${seed.error.message}`,
      );
    }
  }

  const companyName =
    (Array.isArray(spv.companies) ? spv.companies[0] : spv.companies)?.company_name ?? "Company";

  void recordInvestorCrmActivity(supabase, {
    investorId: input.investorId,
    companyId: spv.company_id,
    activityType: "spv_interest_expressed",
    metadata: { spvOpportunityId: input.spvOpportunityId, indicativeAmount: input.indicativeAmount, status },
  });

  void notifyStaffSpvInterest({
    investorId: input.investorId,
    spvOpportunityId: input.spvOpportunityId,
    spvName: spv.name,
    companyName,
    indicativeAmount: input.indicativeAmount,
  });

  if (existing?.status !== status) {
    void notifyInvestorSpvStatusChanged({
      recipientUserId: input.investorId,
      spvOpportunityId: input.spvOpportunityId,
      spvName: spv.name,
      status,
      actorId: input.investorId,
    });
    const admin = createServiceRoleClient();
    const { data: company } = await admin
      .from("companies")
      .select("founder_id")
      .eq("id", spv.company_id)
      .maybeSingle();
    if (company?.founder_id) {
      void notifyInvestorSpvStatusChanged({
        recipientUserId: company.founder_id,
        spvOpportunityId: input.spvOpportunityId,
        spvName: spv.name,
        status,
        actorId: input.investorId,
        title: "SPV participation updated",
        message: `An investor updated participation status to ${status} for ${spv.name}.`,
      });
    }
  }

  const admin = createServiceRoleClient();
  const { refreshSpvOperationalReadiness } = await import("@/lib/spv/sync-readiness");
  await refreshSpvOperationalReadiness(admin, input.spvOpportunityId, {
    actorId: input.investorId,
  });

  return { data: participation };
}

export async function listAdminCompaniesForSpv(admin: SupabaseClient<Database>) {
  const { data } = await admin
    .from("companies")
    .select("id, company_name, review_status, is_published")
    .order("company_name", { ascending: true })
    .limit(200);
  return data ?? [];
}
