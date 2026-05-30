import type { SupabaseClient } from "@supabase/supabase-js";
import { requiredDocumentTypes } from "@/lib/mock-data";
import type { Company, Database, DocumentRecord } from "@/lib/supabase/types";

export type DocumentChecklistItem = {
  label: string;
  code: string;
  status: "missing" | "uploaded" | "needs_review";
  fileName: string | null;
  uploadedAt: string | null;
};

export type ProfileCompletionItem = {
  label: string;
  complete: boolean;
};

export function documentTypeCode(label: string) {
  return label.toUpperCase().replaceAll(" ", "_");
}

export function buildDocumentChecklist(
  documents: DocumentRecord[],
  requiredLabels: string[] = requiredDocumentTypes,
): DocumentChecklistItem[] {
  const uploadedByType = new Map<string, DocumentRecord>();

  for (const document of documents) {
    if (document.document_type) {
      uploadedByType.set(document.document_type, document);
    }
  }

  return requiredLabels.map((label) => {
    const code = documentTypeCode(label);
    const uploaded = uploadedByType.get(code);

    if (!uploaded) {
      return { label, code, status: "missing", fileName: null, uploadedAt: null };
    }

    const normalizedStatus = (uploaded.status ?? "uploaded").toLowerCase();
    const status =
      normalizedStatus.includes("review") || normalizedStatus.includes("pending")
        ? "needs_review"
        : "uploaded";

    return {
      label,
      code,
      status,
      fileName: uploaded.file_name,
      uploadedAt: uploaded.created_at,
    };
  });
}

export function computeReadinessScore(
  uploadedTypeCodes: string[],
  requiredLabels: string[] = requiredDocumentTypes,
) {
  const missingCount = requiredLabels.filter(
    (label) => !uploadedTypeCodes.includes(documentTypeCode(label)),
  ).length;

  return Math.max(55, 90 - missingCount * 6);
}

export function buildProfileCompletion(company: Company | null) {
  if (!company) {
    return { percent: 0, items: [] as ProfileCompletionItem[] };
  }

  const items: ProfileCompletionItem[] = [
    { label: "Company name", complete: Boolean(company.company_name?.trim()) },
    { label: "Industry", complete: Boolean(company.industry?.trim()) },
    { label: "Business description", complete: Boolean(company.business_description && company.business_description.length >= 20) },
    { label: "Funding amount", complete: company.funding_amount != null && company.funding_amount > 0 },
    { label: "Use of funds", complete: Boolean(company.use_of_funds?.trim()) },
    { label: "Revenue stage", complete: Boolean(company.revenue_stage?.trim()) },
    { label: "Team summary", complete: Boolean(company.team_summary?.trim()) },
  ];

  const completeCount = items.filter((item) => item.complete).length;

  return {
    percent: Math.round((completeCount / items.length) * 100),
    items,
  };
}

export async function getLatestDiligenceReport(
  supabase: SupabaseClient<Database>,
  companyId: string,
) {
  return supabase
    .from("diligence_reports")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
}

export async function getLatestAdminReview(
  supabase: SupabaseClient<Database>,
  companyId: string,
) {
  return supabase
    .from("admin_reviews")
    .select("id, status, notes, feedback, requested_changes, reviewed_by, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
}

export function buildRecommendedActions(input: {
  checklist: DocumentChecklistItem[];
  profileItems: ProfileCompletionItem[];
  reviewStatus: string | null;
  reviewFeedback: string | null;
  reportRecommendations: string | null;
  isPublished: boolean;
}) {
  const actions: string[] = [];

  for (const item of input.checklist.filter((row) => row.status === "missing")) {
    actions.push(`Upload ${item.label.toLowerCase()}.`);
  }

  for (const item of input.profileItems.filter((row) => !row.complete)) {
    actions.push(`Complete ${item.label.toLowerCase()} in company settings.`);
  }

  if (input.reviewStatus === "changes_requested" && input.reviewFeedback) {
    actions.push(`Address admin feedback: ${input.reviewFeedback}`);
  } else if (input.reviewStatus === "pending") {
    actions.push("Your company is awaiting admin review.");
  } else if (input.reviewStatus === "rejected") {
    actions.push("Review rejection notes and resubmit updated materials.");
  }

  if (input.reportRecommendations) {
    for (const line of input.reportRecommendations.split("\n").map((part) => part.trim()).filter(Boolean)) {
      if (!actions.includes(line)) {
        actions.push(line);
      }
    }
  }

  if (!input.isPublished && actions.length < 5) {
    actions.push("Review risk disclosures before requesting marketplace publication.");
  }

  return actions.slice(0, 8);
}

export function formatReviewStatus(status: string | null | undefined) {
  if (!status) {
    return "Not submitted";
  }

  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
