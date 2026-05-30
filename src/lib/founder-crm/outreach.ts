import type { SupabaseClient } from "@supabase/supabase-js";
import { OUTREACH_DAILY_LIMIT_MAX, type OutreachCampaignRecord, type OutreachMessageRecord } from "@/lib/founder-crm/types";
import type { Database } from "@/lib/supabase/types";

const ACTIVE_CAMPAIGN_STATUSES = ["draft", "queued", "active"];

export async function listOutreachCampaigns(
  supabase: SupabaseClient<Database>,
  founderId: string,
  companyId: string,
) {
  const { data, error } = await supabase
    .from("outreach_campaigns")
    .select("*")
    .eq("founder_id", founderId)
    .eq("company_id", companyId)
    .order("updated_at", { ascending: false });

  if (error) {
    return { error };
  }

  return { data: (data ?? []) as OutreachCampaignRecord[] };
}

export async function countActiveOutreachCampaigns(
  supabase: SupabaseClient<Database>,
  founderId: string,
) {
  const { count, error } = await supabase
    .from("outreach_campaigns")
    .select("id", { count: "exact", head: true })
    .eq("founder_id", founderId)
    .in("status", ACTIVE_CAMPAIGN_STATUSES);

  if (error) {
    return { error };
  }

  return { count: count ?? 0 };
}

export async function createOutreachCampaign(
  supabase: SupabaseClient<Database>,
  input: {
    founderId: string;
    companyId: string;
    name: string;
    dailyLimit?: number;
  },
) {
  const active = await countActiveOutreachCampaigns(supabase, input.founderId);
  if (active.error) {
    return { error: active.error };
  }

  if ((active.count ?? 0) >= 1) {
    return { error: new Error("Only one active outreach campaign is allowed at a time.") };
  }

  const dailyLimit = Math.min(input.dailyLimit ?? OUTREACH_DAILY_LIMIT_MAX, OUTREACH_DAILY_LIMIT_MAX);
  const { data, error } = await supabase
    .from("outreach_campaigns")
    .insert({
      founder_id: input.founderId,
      company_id: input.companyId,
      name: input.name.trim(),
      status: "draft",
      audience_count: 0,
      daily_limit: dailyLimit,
    })
    .select("*")
    .single();

  if (error) {
    return { error };
  }

  return { data: data as OutreachCampaignRecord };
}

export async function queueOutreachCampaign(
  supabase: SupabaseClient<Database>,
  input: {
    campaignId: string;
    founderId: string;
    messageIds: string[];
  },
) {
  const now = new Date().toISOString();
  const limit = OUTREACH_DAILY_LIMIT_MAX;

  if (input.messageIds.length > limit) {
    return {
      error: new Error(`Campaign exceeds daily limit of ${limit} messages. Reduce audience size.`),
    };
  }

  const { data: messages, error: msgError } = await supabase
    .from("outreach_messages")
    .update({ status: "queued", scheduled_at: now })
    .in("id", input.messageIds)
    .eq("status", "draft")
    .select("id");

  if (msgError) {
    return { error: msgError };
  }

  const { data: campaign, error: campaignError } = await supabase
    .from("outreach_campaigns")
    .update({
      status: "queued",
      audience_count: messages?.length ?? 0,
      updated_at: now,
    })
    .eq("id", input.campaignId)
    .eq("founder_id", input.founderId)
    .select("*")
    .single();

  if (campaignError) {
    return { error: campaignError };
  }

  return { data: campaign as OutreachCampaignRecord };
}

export async function addOutreachMessage(
  supabase: SupabaseClient<Database>,
  input: {
    campaignId: string;
    contactId: string;
    subject: string;
    body: string;
  },
) {
  const { data, error } = await supabase
    .from("outreach_messages")
    .insert({
      campaign_id: input.campaignId,
      contact_id: input.contactId,
      subject: input.subject.trim(),
      body: input.body.trim(),
      status: "draft",
    })
    .select("*")
    .single();

  if (error) {
    return { error };
  }

  return { data: data as OutreachMessageRecord };
}

export async function listOutreachMessages(
  supabase: SupabaseClient<Database>,
  campaignId: string,
) {
  const { data, error } = await supabase
    .from("outreach_messages")
    .select("*, founder_investor_contacts(investor_name, email)")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });

  if (error) {
    return { error };
  }

  return { data: data ?? [] };
}

export async function listOutreachTargets(
  supabase: SupabaseClient<Database>,
  founderId: string,
  companyId: string,
) {
  const { data, error } = await supabase
    .from("founder_outreach_targets")
    .select("*")
    .eq("founder_id", founderId)
    .eq("company_id", companyId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false });

  if (error) {
    return { error };
  }

  return { data: data ?? [] };
}

export async function findOutreachTargetByRef(
  supabase: SupabaseClient<Database>,
  input: {
    founderId: string;
    companyId: string;
    contactId?: string | null;
    platformInvestorId?: string | null;
  },
) {
  let query = supabase
    .from("founder_outreach_targets")
    .select("*")
    .eq("founder_id", input.founderId)
    .eq("company_id", input.companyId)
    .neq("status", "archived");

  if (input.contactId) {
    query = query.eq("contact_id", input.contactId);
  } else if (input.platformInvestorId) {
    query = query.eq("platform_investor_id", input.platformInvestorId);
  } else {
    return { data: null };
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    return { error };
  }

  return { data };
}

export async function upsertOutreachTarget(
  supabase: SupabaseClient<Database>,
  input: {
    founderId: string;
    companyId: string;
    contactId?: string | null;
    platformInvestorId?: string | null;
    matchScore?: number | null;
    status?: string;
    source?: string;
    notes?: string | null;
  },
) {
  const now = new Date().toISOString();
  const existing = await findOutreachTargetByRef(supabase, {
    founderId: input.founderId,
    companyId: input.companyId,
    contactId: input.contactId,
    platformInvestorId: input.platformInvestorId,
  });

  if (existing.error) {
    return { error: existing.error };
  }

  if (existing.data) {
    const { data, error } = await supabase
      .from("founder_outreach_targets")
      .update({
        match_score: input.matchScore ?? existing.data.match_score,
        status: input.status ?? existing.data.status,
        source: input.source ?? existing.data.source,
        notes: input.notes ?? existing.data.notes,
        updated_at: now,
      })
      .eq("id", existing.data.id)
      .eq("founder_id", input.founderId)
      .select("*")
      .single();

    if (error) {
      return { error };
    }

    return { data, created: false };
  }

  const { data, error } = await supabase
    .from("founder_outreach_targets")
    .insert({
      founder_id: input.founderId,
      company_id: input.companyId,
      contact_id: input.contactId ?? null,
      platform_investor_id: input.platformInvestorId ?? null,
      match_score: input.matchScore ?? null,
      status: input.status ?? "selected",
      source: input.source ?? "manual",
      notes: input.notes ?? null,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error) {
    return { error };
  }

  return { data, created: true };
}

export async function updateOutreachTarget(
  supabase: SupabaseClient<Database>,
  input: {
    targetId: string;
    founderId: string;
    patch: Partial<{
      status: string;
      notes: string | null;
      last_contacted_at: string | null;
      next_follow_up_at: string | null;
    }>;
  },
) {
  const { data, error } = await supabase
    .from("founder_outreach_targets")
    .update({ ...input.patch, updated_at: new Date().toISOString() })
    .eq("id", input.targetId)
    .eq("founder_id", input.founderId)
    .select("*")
    .single();

  if (error) {
    return { error };
  }

  return { data };
}

export async function archiveOutreachTarget(
  supabase: SupabaseClient<Database>,
  founderId: string,
  targetId: string,
) {
  return updateOutreachTarget(supabase, {
    targetId,
    founderId,
    patch: { status: "archived" },
  });
}

export type EnrichedOutreachTarget = {
  id: string;
  company_id: string;
  founder_id: string;
  contact_id: string | null;
  platform_investor_id: string | null;
  match_score: number | null;
  status: string;
  source: string;
  notes: string | null;
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
  created_at: string;
  updated_at: string;
  displayName: string;
  displaySubtitle: string | null;
  targetKind: "contact" | "platform" | "unknown";
};

export async function listOutreachTargetsEnriched(
  supabase: SupabaseClient<Database>,
  founderId: string,
  companyId: string,
  platformLabels: Map<string, { label: string; matchScore: number }>,
) {
  const result = await listOutreachTargets(supabase, founderId, companyId);
  if (result.error) {
    return { error: result.error };
  }

  const rows = result.data ?? [];
  const contactIds = rows.map((row) => row.contact_id).filter(Boolean) as string[];

  let contactMap = new Map<string, { investor_name: string; firm_name: string | null }>();
  if (contactIds.length > 0) {
    const { data: contacts } = await supabase
      .from("founder_investor_contacts")
      .select("id, investor_name, firm_name")
      .in("id", contactIds)
      .eq("founder_id", founderId);

    contactMap = new Map((contacts ?? []).map((row) => [row.id, row]));
  }

  const enriched: EnrichedOutreachTarget[] = rows.map((row) => {
    if (row.contact_id) {
      const contact = contactMap.get(row.contact_id);
      return {
        ...row,
        displayName: contact?.investor_name ?? "Private contact",
        displaySubtitle: contact?.firm_name ?? null,
        targetKind: "contact" as const,
      };
    }

    if (row.platform_investor_id) {
      const match = platformLabels.get(row.platform_investor_id);
      return {
        ...row,
        displayName: match?.label ?? "Platform investor",
        displaySubtitle: match ? `${match.matchScore}% match` : null,
        targetKind: "platform" as const,
      };
    }

    return {
      ...row,
      displayName: "Outreach target",
      displaySubtitle: null,
      targetKind: "unknown" as const,
    };
  });

  return { data: enriched };
}

export async function resolveCampaignContactIdsFromTargets(
  supabase: SupabaseClient<Database>,
  founderId: string,
  companyId: string,
  targetIds: string[],
) {
  if (targetIds.length === 0) {
    return { data: [] as string[] };
  }

  const { data, error } = await supabase
    .from("founder_outreach_targets")
    .select("contact_id")
    .eq("founder_id", founderId)
    .eq("company_id", companyId)
    .in("id", targetIds)
    .not("contact_id", "is", null)
    .neq("status", "archived");

  if (error) {
    return { error };
  }

  const ids = [...new Set((data ?? []).map((row) => row.contact_id).filter(Boolean) as string[])];
  return { data: ids };
}

export async function listFollowUpDueContacts(
  supabase: SupabaseClient<Database>,
  founderId: string,
  companyId: string,
) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("founder_outreach_targets")
    .select("id, next_follow_up_at, status, contact_id, platform_investor_id")
    .eq("founder_id", founderId)
    .eq("company_id", companyId)
    .not("next_follow_up_at", "is", null)
    .lte("next_follow_up_at", now)
    .neq("status", "archived");

  if (error) {
    return { error };
  }

  return { data: data ?? [] };
}
