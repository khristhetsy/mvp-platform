import { notifyInvestorsOfCompanyUpdate } from "@/lib/company-updates/notify";
import type {
  CompanyUpdateAdminSummary,
  CompanyUpdateRecord,
  CompanyUpdateType,
  CompanyUpdateVisibility,
} from "@/lib/company-updates/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export function isPublishedVisibility(visibility: string) {
  return visibility === "interested_investors" || visibility === "marketplace";
}

export async function listFounderCompanyUpdates(
  supabase: SupabaseClient<Database>,
  companyId: string,
) {
  const { data, error } = await supabase
    .from("company_updates")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    return { error };
  }

  return { data: (data ?? []) as CompanyUpdateRecord[] };
}

export async function createFounderCompanyUpdate(
  supabase: SupabaseClient<Database>,
  input: {
    companyId: string;
    founderId: string;
    title: string;
    body: string;
    updateType: CompanyUpdateType;
    visibility: CompanyUpdateVisibility;
    publish?: boolean;
  },
) {
  const publishNow = Boolean(input.publish) && isPublishedVisibility(input.visibility);
  const published_at = publishNow ? new Date().toISOString() : null;

  const { data, error } = await supabase
    .from("company_updates")
    .insert({
      company_id: input.companyId,
      founder_id: input.founderId,
      title: input.title.trim(),
      body: input.body.trim(),
      update_type: input.updateType,
      visibility: input.visibility,
      published_at,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { error: error ?? new Error("Unable to save company update.") };
  }

  const record = data as CompanyUpdateRecord;

  if (publishNow) {
    void notifyInvestorsOfCompanyUpdate({
      companyId: input.companyId,
      updateId: record.id,
      title: record.title,
      visibility: record.visibility,
      founderId: input.founderId,
    });
  }

  return { data: record };
}

export async function getInvestorRelatedCompanyIds(
  admin: SupabaseClient<Database>,
  investorId: string,
) {
  const related = new Set<string>();

  const [interests, intros, saved, threads] = await Promise.all([
    admin.from("investor_interests").select("company_id").eq("investor_id", investorId),
    admin.from("intro_requests").select("company_id").eq("investor_id", investorId),
    admin.from("saved_deals").select("company_id").eq("investor_id", investorId),
    admin.from("message_threads").select("company_id").eq("investor_id", investorId),
  ]);

  for (const row of interests.data ?? []) {
    if (row.company_id) related.add(row.company_id);
  }
  for (const row of intros.data ?? []) {
    if (row.company_id) related.add(row.company_id);
  }
  for (const row of saved.data ?? []) {
    if (row.company_id) related.add(row.company_id);
  }
  for (const row of threads.data ?? []) {
    if (row.company_id) related.add(row.company_id);
  }

  return related;
}

export function investorCanViewCompanyUpdate(
  update: Pick<CompanyUpdateRecord, "company_id" | "visibility" | "published_at">,
  relatedCompanyIds: Set<string>,
) {
  if (!update.published_at) {
    return false;
  }
  if (update.visibility === "draft" || update.visibility === "private") {
    return false;
  }
  if (update.visibility === "marketplace") {
    return true;
  }
  if (update.visibility === "interested_investors") {
    return relatedCompanyIds.has(update.company_id);
  }
  return false;
}

export async function listInvestorVisibleCompanyUpdates(investorId: string, limit = 50) {
  const admin = createServiceRoleClient();
  const relatedCompanyIds = await getInvestorRelatedCompanyIds(admin, investorId);

  const { data, error } = await admin
    .from("company_updates")
    .select("*, companies(company_name, slug)")
    .not("published_at", "is", null)
    .in("visibility", ["interested_investors", "marketplace"])
    .order("published_at", { ascending: false })
    .limit(limit * 3);

  if (error) {
    return { error, data: [] as CompanyUpdateRecord[] };
  }

  const visible = (data ?? [])
    .filter((row) => investorCanViewCompanyUpdate(row as CompanyUpdateRecord, relatedCompanyIds))
    .slice(0, limit) as CompanyUpdateRecord[];

  return { data: visible, relatedCompanyIds };
}

export async function getCompanyUpdateAdminSummaries(
  companyIds: string[],
): Promise<Map<string, CompanyUpdateAdminSummary>> {
  const result = new Map<string, CompanyUpdateAdminSummary>();
  if (companyIds.length === 0) {
    return result;
  }

  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("company_updates")
    .select("company_id, published_at")
    .in("company_id", companyIds)
    .not("published_at", "is", null);

  for (const companyId of companyIds) {
    result.set(companyId, { publishedCount: 0, latestPublishedAt: null });
  }

  for (const row of data ?? []) {
    const current = result.get(row.company_id) ?? { publishedCount: 0, latestPublishedAt: null };
    current.publishedCount += 1;
    if (
      !current.latestPublishedAt ||
      new Date(row.published_at).getTime() > new Date(current.latestPublishedAt).getTime()
    ) {
      current.latestPublishedAt = row.published_at;
    }
    result.set(row.company_id, current);
  }

  return result;
}

export async function listInvestorCompaniesWithMeetings(
  admin: SupabaseClient<Database>,
  investorId: string,
) {
  const { data: meetings } = await admin
    .from("thread_meetings")
    .select("company_id, status, proposed_start_time, companies(company_name, slug)")
    .eq("investor_id", investorId)
    .order("created_at", { ascending: false });

  const byCompany = new Map<
    string,
    {
      companyId: string;
      companyName: string;
      slug: string | null;
      scheduledCount: number;
      lastMeetingAt: string | null;
    }
  >();

  for (const row of meetings ?? []) {
    if (!row.company_id) continue;
    const company = Array.isArray(row.companies) ? row.companies[0] : row.companies;
    const existing = byCompany.get(row.company_id) ?? {
      companyId: row.company_id,
      companyName: company?.company_name ?? "Company",
      slug: company?.slug ?? null,
      scheduledCount: 0,
      lastMeetingAt: null,
    };
    if (row.status === "scheduled") {
      existing.scheduledCount += 1;
    }
    const at = row.proposed_start_time ?? null;
    if (at && (!existing.lastMeetingAt || new Date(at) > new Date(existing.lastMeetingAt))) {
      existing.lastMeetingAt = at;
    }
    byCompany.set(row.company_id, existing);
  }

  return [...byCompany.values()];
}
