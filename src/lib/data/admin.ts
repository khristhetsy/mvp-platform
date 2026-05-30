import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { getStorageBucket, createSignedDocumentUrl } from "@/lib/data/documents";
import type { SubscriptionRecord } from "@/lib/subscriptions/plans";
import type { PlanType } from "@/lib/subscriptions/plans";

export type AdminCompanyRow = {
  id: string;
  company_name: string;
  industry: string | null;
  review_status: string | null;
  status: string | null;
  business_description: string | null;
  created_at: string;
  approved_at: string | null;
  is_published: boolean | null;
  marketplace_visible: boolean | null;
  published_at: string | null;
  slug: string | null;
  founder_id: string;
  founder: { id: string; full_name: string | null; email: string | null; role: string | null } | null;
  documents: Array<{
    id: string;
    document_type: string | null;
    file_name: string | null;
    file_path: string | null;
    status: string | null;
    created_at: string;
  }>;
  admin_reviews: Array<{
    id: string;
    status: string | null;
    notes: string | null;
    feedback: string | null;
    requested_changes: string | null;
    reviewed_by: string | null;
    created_at: string;
  }>;
  pitchDeckUrl: string | null;
};

type CompanyWithRelations = {
  id: string;
  company_name: string;
  industry: string | null;
  review_status: string | null;
  status: string | null;
  business_description: string | null;
  created_at: string;
  approved_at: string | null;
  is_published: boolean | null;
  marketplace_visible: boolean | null;
  published_at: string | null;
  slug: string | null;
  founder_id: string;
  profiles: { id: string; full_name: string | null; email: string | null; role: string | null } | null;
  documents: AdminCompanyRow["documents"];
  admin_reviews: AdminCompanyRow["admin_reviews"];
};

export async function getAdminDashboardMetrics(supabase: SupabaseClient<Database>) {
  const [founders, companies, pendingReviews, documents, pitchDecks] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).ilike("role", "founder"),
    supabase.from("companies").select("id", { count: "exact", head: true }),
    supabase.from("companies").select("id", { count: "exact", head: true }).eq("review_status", "pending"),
    supabase.from("documents").select("id", { count: "exact", head: true }),
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("document_type", "PITCH_DECK"),
  ]);

  const published = await supabase
    .from("companies")
    .select("id", { count: "exact", head: true })
    .eq("review_status", "approved")
    .eq("is_published", true)
    .eq("marketplace_visible", true)
    .not("published_at", "is", null);

  const pendingCount =
    pendingReviews.error?.code === "42703"
      ? (await supabase.from("companies").select("id", { count: "exact", head: true }).eq("status", "in_review")).count ?? 0
      : pendingReviews.count ?? 0;

  const publishedCount =
    published.error?.code === "42703"
      ? (await supabase.from("companies").select("id", { count: "exact", head: true }).eq("status", "published")).count ?? 0
      : published.count ?? 0;

  return {
    founders: founders.count ?? 0,
    companies: companies.count ?? 0,
    pendingReviews: pendingCount,
    documents: documents.count ?? 0,
    pitchDecks: pitchDecks.count ?? 0,
    publishedDeals: publishedCount,
  };
}

export async function listAdminCompanies(supabase: SupabaseClient<Database>): Promise<AdminCompanyRow[]> {
  const selectWithReview = `
      id,
      company_name,
      industry,
      review_status,
      status,
      business_description,
      created_at,
      approved_at,
      is_published,
      marketplace_visible,
      published_at,
      slug,
      founder_id,
      profiles:founder_id ( id, full_name, email, role ),
      documents ( id, document_type, file_name, file_path, status, created_at ),
      admin_reviews ( id, status, notes, feedback, requested_changes, reviewed_by, created_at )
    `;

  const selectLegacy = `
      id,
      company_name,
      industry,
      status,
      business_description,
      created_at,
      founder_id,
      profiles:founder_id ( id, full_name, email, role ),
      documents ( id, document_type, file_name, file_path, status, created_at ),
      admin_reviews ( id, status, notes, reviewed_by, created_at )
    `;

  let result = await supabase.from("companies").select(selectWithReview).order("created_at", { ascending: false });

  if (result.error?.code === "42703") {
    result = await supabase.from("companies").select(selectLegacy).order("created_at", { ascending: false });
  }

  if (result.error) {
    throw new Error(result.error.message);
  }

  const rows = (result.data as CompanyWithRelations[] | null) ?? [];
  const service = createServiceRoleClient();

  return Promise.all(
    rows.map(async (row) => {
      const pitchDeck = row.documents?.find(
        (doc) => doc.document_type?.toUpperCase() === "PITCH_DECK",
      );
      let pitchDeckUrl: string | null = null;

      if (pitchDeck?.file_path) {
        const bucket = getStorageBucket(pitchDeck.document_type ?? "PITCH_DECK");
        const signed = await createSignedDocumentUrl(service, bucket, pitchDeck.file_path, 3600);
        pitchDeckUrl = signed.data?.signedUrl ?? null;
      }

      return {
        id: row.id,
        company_name: row.company_name,
        industry: row.industry,
        review_status: row.review_status ?? row.status ?? "pending",
        status: row.status,
        business_description: row.business_description,
        created_at: row.created_at,
        approved_at: row.approved_at ?? null,
        is_published: row.is_published ?? false,
        marketplace_visible: row.marketplace_visible ?? false,
        published_at: row.published_at ?? null,
        slug: row.slug ?? null,
        founder_id: row.founder_id,
        founder: row.profiles,
        documents: row.documents ?? [],
        admin_reviews: (row.admin_reviews ?? []).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ),
        pitchDeckUrl,
      };
    }),
  );
}

export type AdminCompanyCardPayload = {
  id: string;
  company_name: string;
  industry: string | null;
  review_status: string | null;
  is_published: boolean;
  marketplace_visible: boolean;
  published_at: string | null;
  slug: string | null;
  business_description: string | null;
  created_at: string;
  founder_name: string;
  founder_email: string;
  pitch_deck_url: string | null;
  pitch_deck_id: string | null;
  documents: Array<{
    id: string;
    file_name: string | null;
    document_type: string | null;
    created_at: string;
  }>;
  initial_feedback: string;
  founder_subscription: SubscriptionRecord | null;
  founder_requested_plan: PlanType | null;
};

export function mapAdminCompaniesToCardData(
  companies: AdminCompanyRow[],
  subscriptionsByProfileId: Map<string, SubscriptionRecord> = new Map(),
  requestedPlansByProfileId: Map<string, PlanType | null> = new Map(),
): AdminCompanyCardPayload[] {
  return companies.map((company) => {
    const latestReview = company.admin_reviews[0];
    const pitchDeck = company.documents.find((doc) => doc.document_type?.toUpperCase() === "PITCH_DECK");

    return {
      id: company.id,
      company_name: company.company_name,
      industry: company.industry,
      review_status: company.review_status,
      is_published: company.is_published ?? false,
      marketplace_visible: company.marketplace_visible ?? false,
      published_at: company.published_at ?? null,
      slug: company.slug,
      business_description: company.business_description,
      created_at: company.created_at,
      founder_name: company.founder?.full_name ?? "Unknown founder",
      founder_email: company.founder?.email ?? "—",
      pitch_deck_url: company.pitchDeckUrl,
      pitch_deck_id: pitchDeck?.id ?? null,
      documents: company.documents,
      initial_feedback:
        latestReview?.feedback ?? latestReview?.requested_changes ?? latestReview?.notes ?? "",
      founder_subscription: subscriptionsByProfileId.get(company.founder_id) ?? null,
      founder_requested_plan: requestedPlansByProfileId.get(company.founder_id) ?? null,
    };
  });
}

export async function listFounders(supabase: SupabaseClient<Database>) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, created_at")
    .ilike("role", "founder")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}
