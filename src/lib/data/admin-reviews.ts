import type { SupabaseClient } from "@supabase/supabase-js";
import { adminDebug } from "@/lib/debug/admin-debug";
import type { Database } from "@/lib/supabase/types";
import { ensureCompanySlug, ensurePublishedCampaign } from "@/lib/data/marketplace";
import type { Company } from "@/lib/supabase/types";

export type ReviewAction = "approve" | "reject" | "changes_requested";

type CompanyUpdate = Database["public"]["Tables"]["companies"]["Update"];
type AdminReviewUpdate = Database["public"]["Tables"]["admin_reviews"]["Update"];

export async function applyCompanyReview(
  supabase: SupabaseClient<Database>,
  input: {
    companyId: string;
    adminId: string;
    action: ReviewAction;
    feedback?: string;
  },
) {
  adminDebug({
    scope: "admin-reviews.applyCompanyReview",
    action: input.action,
    userId: input.adminId,
    companyId: input.companyId,
    payload: { feedback: input.feedback ?? null },
    query: "companies.select(id, founder_id).eq(id).single()",
  });

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id, founder_id")
    .eq("id", input.companyId)
    .single();

  if (companyError || !company) {
    adminDebug({
      scope: "admin-reviews.applyCompanyReview",
      action: input.action,
      companyId: input.companyId,
      error: companyError ?? { message: "Company not found." },
    });
    return { error: companyError ?? { message: "Company not found." } };
  }

  const founderId = company.founder_id;
  const now = new Date().toISOString();
  let reviewStatus: string;
  let companyStatus: string;
  const feedback = input.feedback?.trim() ?? null;
  let requestedChanges: string | null = null;

  switch (input.action) {
    case "approve":
      reviewStatus = "approved";
      companyStatus = "approved";
      break;
    case "reject":
      reviewStatus = "rejected";
      companyStatus = "rejected";
      break;
    case "changes_requested":
      reviewStatus = "changes_requested";
      companyStatus = "changes_requested";
      requestedChanges = feedback;
      break;
    default:
      return { error: { message: "Invalid review action." } };
  }

  const companyUpdate: CompanyUpdate = {
    review_status: reviewStatus,
    status: companyStatus,
    updated_at: now,
  };

  if (input.action === "approve") {
    companyUpdate.approved_at = now;
    companyUpdate.approved_by = input.adminId;
    companyUpdate.status = "approved";
  } else {
    companyUpdate.approved_at = null;
    companyUpdate.approved_by = null;
    companyUpdate.is_published = false;
    companyUpdate.marketplace_visible = false;
    companyUpdate.published_at = null;
  }

  const { data: updatedCompany, error: updateError } = await supabase
    .from("companies")
    .update(companyUpdate)
    .eq("id", input.companyId)
    .select("*")
    .single();

  adminDebug({
    scope: "admin-reviews.applyCompanyReview",
    action: input.action,
    companyId: input.companyId,
    query: "companies.update(review/marketplace fields).select(*).single()",
    response: updatedCompany ? { id: updatedCompany.id, review_status: updatedCompany.review_status, slug: updatedCompany.slug } : null,
    error: updateError,
  });

  if (updateError) {
    return { error: updateError };
  }

  if (input.action === "approve" && updatedCompany) {
    const slug = await ensureCompanySlug(supabase, updatedCompany as Company);
    adminDebug({
      scope: "admin-reviews.applyCompanyReview",
      action: "ensure_slug",
      companyId: input.companyId,
      slug,
      query: "ensureCompanySlug()",
    });

    const campaignResult = await ensurePublishedCampaign(
      supabase,
      { ...(updatedCompany as Company), slug },
      slug,
      now,
    );

    adminDebug({
      scope: "admin-reviews.applyCompanyReview",
      action: "ensure_campaign",
      companyId: input.companyId,
      slug,
      query: "ensurePublishedCampaign()",
      response: "data" in campaignResult ? campaignResult.data : null,
      error: "error" in campaignResult ? campaignResult.error : null,
    });

    if ("error" in campaignResult && campaignResult.error) {
      return { error: campaignResult.error };
    }

    const { data: publishedCompany, error: publishError } = await supabase
      .from("companies")
      .update({
        is_published: true,
        marketplace_visible: true,
        published_at: now,
        status: "published",
        updated_at: now,
      })
      .eq("id", input.companyId)
      .select("*")
      .single();

    adminDebug({
      scope: "admin-reviews.applyCompanyReview",
      action: "publish_after_campaign",
      companyId: input.companyId,
      slug,
      query: "companies.update(is_published, marketplace_visible, published_at)",
      response: publishedCompany ? { id: publishedCompany.id, slug: publishedCompany.slug } : null,
      error: publishError,
    });

    if (publishError) {
      return { error: publishError };
    }

    if (publishedCompany) {
      Object.assign(updatedCompany, publishedCompany);
    }
  }

  if (input.action === "reject" || input.action === "changes_requested") {
    await supabase
      .from("campaigns")
      .update({ status: "draft", published_at: null })
      .eq("company_id", input.companyId);
  }

  const reviewResult = await upsertAdminReview(supabase, {
    companyId: input.companyId,
    founderId,
    adminId: input.adminId,
    status: reviewStatus,
    feedback,
    requestedChanges,
    now,
  });

  adminDebug({
    scope: "admin-reviews.applyCompanyReview",
    action: "upsert_admin_review",
    companyId: input.companyId,
    query: "admin_reviews upsert",
    response: reviewResult.data ? { id: reviewResult.data.id, status: reviewResult.data.status } : null,
    error: reviewResult.error,
  });

  if (reviewResult.error) {
    return { error: reviewResult.error };
  }

  adminDebug({
    scope: "admin-reviews.applyCompanyReview",
    action: input.action,
    companyId: input.companyId,
    response: { ok: true },
  });

  return { data: { company: updatedCompany, review: reviewResult.data } };
}

export async function saveAdminFeedback(
  supabase: SupabaseClient<Database>,
  input: {
    companyId: string;
    adminId: string;
    feedback: string;
  },
) {
  adminDebug({
    scope: "admin-reviews.saveAdminFeedback",
    action: "save_feedback",
    userId: input.adminId,
    companyId: input.companyId,
    payload: { feedbackLength: input.feedback.length },
    query: "companies.select(id, founder_id).eq(id).single()",
  });

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id, founder_id")
    .eq("id", input.companyId)
    .single();

  if (companyError || !company) {
    adminDebug({
      scope: "admin-reviews.saveAdminFeedback",
      companyId: input.companyId,
      error: companyError ?? { message: "Company not found." },
    });
    return { error: companyError ?? { message: "Company not found." } };
  }

  const now = new Date().toISOString();
  const reviewResult = await upsertAdminReview(supabase, {
    companyId: input.companyId,
    founderId: company.founder_id,
    adminId: input.adminId,
    status: null,
    feedback: input.feedback.trim(),
    requestedChanges: null,
    now,
    notesOnly: true,
  });

  if (reviewResult.error) {
    adminDebug({
      scope: "admin-reviews.saveAdminFeedback",
      companyId: input.companyId,
      error: reviewResult.error,
    });
    return { error: reviewResult.error };
  }

  adminDebug({
    scope: "admin-reviews.saveAdminFeedback",
    companyId: input.companyId,
    response: { ok: true, reviewId: reviewResult.data?.id },
  });

  return { data: { review: reviewResult.data } };
}

async function upsertAdminReview(
  supabase: SupabaseClient<Database>,
  input: {
    companyId: string;
    founderId: string;
    adminId: string;
    status: string | null;
    feedback: string | null;
    requestedChanges: string | null;
    now: string;
    notesOnly?: boolean;
  },
) {
  const { data: existing } = await supabase
    .from("admin_reviews")
    .select("id, status")
    .eq("company_id", input.companyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const reviewUpdate: AdminReviewUpdate = {
    reviewed_by: input.adminId,
    founder_id: input.founderId,
    feedback: input.feedback,
    notes: input.feedback,
    requested_changes: input.requestedChanges,
    updated_at: input.now,
  };

  if (!input.notesOnly && input.status) {
    reviewUpdate.status = input.status;
  } else if (input.notesOnly) {
    delete reviewUpdate.status;
  }

  if (existing?.id) {
    return supabase.from("admin_reviews").update(reviewUpdate).eq("id", existing.id).select("*").single();
  }

  return supabase
    .from("admin_reviews")
    .insert({
      company_id: input.companyId,
      founder_id: input.founderId,
      reviewed_by: input.adminId,
      status: input.status ?? "pending",
      feedback: input.feedback,
      notes: input.feedback,
      requested_changes: input.requestedChanges,
    })
    .select("*")
    .single();
}
