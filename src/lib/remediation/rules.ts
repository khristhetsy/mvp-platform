import { documentTypeCode, buildDocumentChecklist } from "@/lib/data/founder-readiness";
import { requiredDocumentTypes } from "@/lib/mock-data";
import { computeFounderOnboardingProgress } from "@/lib/onboarding/progress";
import type { Company, DocumentRecord } from "@/lib/supabase/types";
import type { RemediationTaskDraft } from "@/lib/remediation/types";

export const READINESS_SCORE_THRESHOLD = 75;

const AUTO_DESCRIPTION = "Company profile created automatically during onboarding.";

type DiligenceReportLike = {
  readiness_score: number | null;
  missing_documents: unknown;
  risk_flags: unknown;
  recommendations: string | null;
};

function parseStringList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item)).filter(Boolean);
      }
    } catch {
      return value
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
    }
  }

  return [];
}

function hasDocumentType(documents: DocumentRecord[], code: string) {
  return documents.some((document) => document.document_type?.toUpperCase() === code);
}

function isReviewSubmitted(company: Company) {
  const status = company.review_status ?? company.status ?? null;
  return Boolean(status && status !== "draft");
}

export function buildRemediationTaskDrafts(input: {
  company: Company;
  documents: DocumentRecord[];
  diligenceReport: DiligenceReportLike | null;
  onboardingPercent: number;
}): RemediationTaskDraft[] {
  const tasks: RemediationTaskDraft[] = [];
  const { company } = input;
  const description = company.business_description?.trim() ?? "";

  if (!description || description.length < 20 || description === AUTO_DESCRIPTION) {
    tasks.push({
      source_type: "profile_gap",
      source_key: "profile:company_description",
      category: "company_profile",
      title: "Complete your company description",
      description: "Investors need a clear narrative about your product, market, and traction before engaging.",
      priority: "high",
      recommended_action: "Add a compelling company description in onboarding.",
      related_feature: "/founder/onboarding",
    });
  }

  if (!company.industry?.trim()) {
    tasks.push({
      source_type: "profile_gap",
      source_key: "profile:industry",
      category: "company_profile",
      title: "Add your industry / sector",
      description: "Sector context helps investors benchmark your company against relevant peers.",
      priority: "medium",
      recommended_action: "Specify your industry in company onboarding.",
      related_feature: "/founder/onboarding",
    });
  }

  if (!company.founder_goals?.trim() || company.founder_goals.trim().length < 10) {
    tasks.push({
      source_type: "profile_gap",
      source_key: "profile:founder_goals",
      category: "company_profile",
      title: "Define founder goals and objectives",
      description: "Articulate how capital will accelerate milestones investors care about.",
      priority: "medium",
      recommended_action: "Document your fundraising goals in onboarding.",
      related_feature: "/founder/onboarding",
    });
  }

  if (!company.website?.trim()) {
    tasks.push({
      source_type: "profile_gap",
      source_key: "profile:website",
      category: "investor_materials",
      title: "Add your company website",
      description: "A public website improves investor confidence during initial screening.",
      priority: "low",
      recommended_action: "Add your website URL in company settings.",
      related_feature: "/founder/settings",
    });
  }

  if (company.funding_amount == null || company.funding_amount <= 0) {
    tasks.push({
      source_type: "funding_gap",
      source_key: "financials:target_raise",
      category: "financials",
      title: "Set your target raise amount",
      description: "A defined raise target anchors investor conversations and diligence scope.",
      priority: "high",
      recommended_action: "Enter your funding target in onboarding.",
      related_feature: "/founder/onboarding",
    });
  }

  if (!company.revenue_stage?.trim()) {
    tasks.push({
      source_type: "funding_gap",
      source_key: "financials:funding_stage",
      category: "financials",
      title: "Specify your funding stage",
      description: "Stage alignment helps investors assess fit and check size expectations.",
      priority: "medium",
      recommended_action: "Add your funding stage in onboarding.",
      related_feature: "/founder/onboarding",
    });
  }

  if (!company.use_of_funds?.trim()) {
    tasks.push({
      source_type: "funding_gap",
      source_key: "financials:use_of_funds",
      category: "financials",
      title: "Describe use of funds",
      description: "Investors expect clarity on how capital will be deployed over the next 12–18 months.",
      priority: "high",
      recommended_action: "Complete use-of-funds details in onboarding.",
      related_feature: "/founder/onboarding",
    });
  }

  if (!hasDocumentType(input.documents, "PITCH_DECK")) {
    tasks.push({
      source_type: "document_gap",
      source_key: "documents:missing_pitch_deck",
      category: "documents",
      title: "Upload your pitch deck",
      description: "A pitch deck is the primary investor-ready artifact for marketplace and diligence review.",
      priority: "high",
      recommended_action: "Upload your pitch deck to the document room.",
      related_feature: "/founder/documents",
    });
  }

  if (!hasDocumentType(input.documents, "FINANCIAL_STATEMENTS")) {
    tasks.push({
      source_type: "document_gap",
      source_key: "documents:missing_financial_statements",
      category: "financials",
      title: "Upload financial statements",
      description: "Financial evidence supports readiness scoring and investor due diligence.",
      priority: "high",
      recommended_action: "Upload financial statements.",
      related_feature: "/founder/documents",
    });
  }

  const checklist = buildDocumentChecklist(input.documents);
  for (const item of checklist.filter((row) => row.status === "missing")) {
    const code = documentTypeCode(item.label);
    if (code === "PITCH_DECK" || code === "FINANCIAL_STATEMENTS") {
      continue;
    }

    tasks.push({
      source_type: "document_gap",
      source_key: `documents:missing_${code.toLowerCase()}`,
      category: code.includes("LEGAL") || code.includes("CORPORATE") ? "governance" : "documents",
      title: `Upload ${item.label.toLowerCase()}`,
      description: `${item.label} is required for a complete investor diligence package.`,
      priority: "medium",
      recommended_action: `Upload ${item.label.toLowerCase()} in the document room.`,
      related_feature: "/founder/documents",
    });
  }

  if (!input.diligenceReport) {
    tasks.push({
      source_type: "diligence_gap",
      source_key: "readiness:no_diligence_report",
      category: "readiness",
      title: "Generate your AI diligence report",
      description: "A diligence report surfaces gaps, risk flags, and readiness improvements from your materials.",
      priority: "high",
      recommended_action: "Review readiness insights and request diligence analysis.",
      related_feature: "/founder/readiness",
    });
  } else {
    const score = input.diligenceReport.readiness_score ?? 0;
    if (score < READINESS_SCORE_THRESHOLD) {
      tasks.push({
        source_type: "diligence_gap",
        source_key: "readiness:score_below_threshold",
        category: "readiness",
        title: "Improve your readiness score",
        description: `Your readiness score is ${score}. Scores above ${READINESS_SCORE_THRESHOLD} improve investor confidence.`,
        priority: "high",
        recommended_action: "Address open remediation tasks and upload missing materials.",
        related_feature: "/founder/readiness",
      });
    }

    for (const missing of parseStringList(input.diligenceReport.missing_documents)) {
      const key = `diligence:missing_${missing.toLowerCase().replaceAll(/[^a-z0-9]+/g, "_")}`;
      tasks.push({
        source_type: "diligence_report",
        source_key: key,
        category: "documents",
        title: `Resolve diligence gap: ${missing}`,
        description: "Your latest diligence report flagged this item as missing.",
        priority: "high",
        recommended_action: "Upload or update the referenced material.",
        related_feature: "/founder/documents",
      });
    }

    for (const flag of parseStringList(input.diligenceReport.risk_flags).slice(0, 5)) {
      const key = `diligence:risk_${flag.toLowerCase().replaceAll(/[^a-z0-9]+/g, "_").slice(0, 48)}`;
      tasks.push({
        source_type: "diligence_report",
        source_key: key,
        category: "governance",
        title: "Address diligence risk flag",
        description: flag,
        priority: "medium",
        recommended_action: "Review the risk in your readiness workspace and update materials.",
        related_feature: "/founder/readiness",
      });
    }
  }

  if (!isReviewSubmitted(company)) {
    tasks.push({
      source_type: "review_gap",
      source_key: "compliance:not_submitted_review",
      category: "compliance",
      title: "Submit for investor readiness review",
      description: "Admin review is required before marketplace visibility and institutional investor workflows.",
      priority: "high",
      recommended_action: "Complete onboarding and submit your company for review.",
      related_feature: "/founder/onboarding",
    });
  }

  const reviewStatus = company.review_status ?? company.status ?? null;
  if (reviewStatus === "changes_requested") {
    tasks.push({
      source_type: "review_gap",
      source_key: "compliance:changes_requested",
      category: "compliance",
      title: "Address admin change requests",
      description: "Your submission needs updates before it can progress in the review pipeline.",
      priority: "high",
      recommended_action: "Review admin feedback and update your profile and documents.",
      related_feature: "/founder/settings",
    });
  }

  if (input.onboardingPercent < 100) {
    tasks.push({
      source_type: "onboarding_gap",
      source_key: "readiness:incomplete_onboarding",
      category: "readiness",
      title: "Complete founder onboarding",
      description: `Onboarding is ${input.onboardingPercent}% complete. Finishing onboarding improves investor visibility during your trial.`,
      priority: "medium",
      recommended_action: "Continue onboarding to strengthen your investor-ready profile.",
      related_feature: "/founder/onboarding",
    });
  }

  const uploadedTypes = input.documents.flatMap((document) =>
    document.document_type ? [document.document_type] : [],
  );
  const missingCount = requiredDocumentTypes.filter(
    (label) => !uploadedTypes.includes(documentTypeCode(label)),
  ).length;

  if (missingCount >= 3) {
    tasks.push({
      source_type: "materials_gap",
      source_key: "investor_materials:incomplete_data_room",
      category: "investor_materials",
      title: "Build investor-ready materials",
      description: "Multiple core diligence documents are still missing from your data room.",
      priority: "high",
      recommended_action: "Upload remaining required documents.",
      related_feature: "/founder/documents",
    });
  }

  if (!company.team_summary?.trim()) {
    tasks.push({
      source_type: "profile_gap",
      source_key: "profile:team_summary",
      category: "market",
      title: "Add team summary",
      description: "Investors evaluate founder-market fit and team depth alongside financials.",
      priority: "low",
      recommended_action: "Add team context in company settings or onboarding.",
      related_feature: "/founder/settings",
    });
  }

  const progress = computeFounderOnboardingProgress({
    company,
    documents: input.documents,
    diligenceReportExists: Boolean(input.diligenceReport),
    storedStepState: company.onboarding_step_state,
  });

  if (!progress.steps.documents_uploaded.completed && hasDocumentType(input.documents, "PITCH_DECK")) {
    // covered by pitch deck task
  }

  return dedupeDraftsByKey(tasks);
}

function dedupeDraftsByKey(tasks: RemediationTaskDraft[]) {
  const map = new Map<string, RemediationTaskDraft>();

  for (const task of tasks) {
    map.set(task.source_key, task);
  }

  return Array.from(map.values());
}

export function sortRemediationTasks<T extends { priority: string; status: string; created_at?: string }>(
  tasks: T[],
) {
  const priorityWeight = { high: 0, medium: 1, low: 2 };
  const statusWeight = { open: 0, in_progress: 1, completed: 2, dismissed: 3 };

  return [...tasks].sort((a, b) => {
    const statusDiff =
      (statusWeight[a.status as keyof typeof statusWeight] ?? 9) -
      (statusWeight[b.status as keyof typeof statusWeight] ?? 9);

    if (statusDiff !== 0) {
      return statusDiff;
    }

    const priorityDiff =
      (priorityWeight[a.priority as keyof typeof priorityWeight] ?? 9) -
      (priorityWeight[b.priority as keyof typeof priorityWeight] ?? 9);

    return priorityDiff;
  });
}
