import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { InvestorApprovalStatus, InvestorProfileRecord } from "@/lib/investor/types";

export async function getInvestorProfileByProfileId(profileId: string) {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("investor_profiles")
    .select("*")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load investor profile: ${error.message}`);
  }

  return (data as InvestorProfileRecord | null) ?? null;
}

export async function ensureInvestorProfileForUser(profileId: string) {
  const existing = await getInvestorProfileByProfileId(profileId);
  if (existing) {
    return existing;
  }

  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("investor_profiles")
    .insert({
      profile_id: profileId,
      approval_status: "draft",
      accredited_status: false,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create investor profile: ${error.message}`);
  }

  return data as InvestorProfileRecord;
}

export function parseCommaList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export type InvestorOnboardingProgress = {
  percent: number;
  isComplete: boolean;
  profileComplete: boolean;
  submitted: boolean;
  approved: boolean;
  needsResubmit: boolean;
  approvalStatus: InvestorApprovalStatus;
  adminFeedback: string | null;
};

export function computeInvestorOnboardingProgress(
  record: InvestorProfileRecord,
): InvestorOnboardingProgress {
  const profileComplete =
    isInvestorProfileComplete(record) ||
    record.approval_status !== "draft";

  const submitted = ["submitted", "approved"].includes(record.approval_status);
  const needsResubmit = ["changes_requested", "rejected"].includes(record.approval_status);
  const approved = record.approval_status === "approved";

  const completedCount = [profileComplete, submitted || needsResubmit, approved].filter(Boolean).length;
  // submitted OR needsResubmit both count as "step 2 touched" for progress display
  const percent = Math.round((completedCount / 3) * 100);

  return {
    percent,
    isComplete: approved,
    profileComplete,
    submitted,
    approved,
    needsResubmit,
    approvalStatus: record.approval_status,
    adminFeedback: record.admin_feedback,
  };
}

export function isInvestorProfileComplete(record: InvestorProfileRecord) {
  return Boolean(
    record.investor_type?.trim() &&
      record.investment_thesis?.trim() &&
      record.investment_thesis.trim().length >= 20 &&
      record.contact_preference?.trim() &&
      record.accredited_status &&
      (record.preferred_sectors.length > 0 || record.preferred_geographies.length > 0),
  );
}

export async function listInvestorProfilesForAdmin() {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("investor_profiles")
    .select("*, profiles:profile_id(id, full_name, email, role, created_at)")
    .order("submitted_at", { ascending: false, nullsFirst: false });

  if (error) {
    throw new Error(`Failed to list investor profiles: ${error.message}`);
  }

  return (data ?? []) as Array<
    InvestorProfileRecord & {
      profiles: { id: string; full_name: string | null; email: string | null; role: string | null; created_at: string } | null;
    }
  >;
}

export async function applyInvestorReview(input: {
  investorProfileId: string;
  adminId: string;
  action: "approve" | "reject" | "changes_requested";
  feedback?: string | null;
}) {
  const admin = createServiceRoleClient();
  const now = new Date().toISOString();

  let approval_status: InvestorApprovalStatus;
  if (input.action === "approve") {
    approval_status = "approved";
  } else if (input.action === "reject") {
    approval_status = "rejected";
  } else {
    approval_status = "changes_requested";
  }

  const { data, error } = await admin
    .from("investor_profiles")
    .update({
      approval_status,
      admin_feedback: input.feedback?.trim() || null,
      approved_at: input.action === "approve" ? now : null,
      approved_by: input.action === "approve" ? input.adminId : null,
      updated_at: now,
    })
    .eq("id", input.investorProfileId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to update investor profile review.");
  }

  return data as InvestorProfileRecord;
}
