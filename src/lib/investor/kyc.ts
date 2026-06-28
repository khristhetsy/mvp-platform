import { createServiceRoleClient } from "@/lib/supabase/admin";
import type {
  InvestorKycDocumentRecord,
  InvestorKycStatus,
  InvestorProfileRecord,
} from "@/lib/investor/types";

/** Private storage bucket holding investor KYC files (signed URLs only). */
export const KYC_BUCKET = "investor-kyc";

export type KycDocType =
  | "government_id"
  | "accreditation_evidence"
  | "source_of_funds"
  | "entity_formation"
  | "beneficial_ownership";

export type KycChecklistItem = {
  code: KycDocType;
  label: string;
  description: string;
  required: boolean;
};

/** Entity-style investors need formation + ownership docs; individuals need ID. */
export function isEntityInvestorType(investorType: string | null | undefined): boolean {
  return ["angel_group", "family_office", "venture_fund", "corporate"].includes(
    (investorType ?? "").trim(),
  );
}

// Light verification — same for every investor type. Identity is the only
// required upload; accreditation evidence is optional and boosts the score.
const LIGHT_CHECKLIST: KycChecklistItem[] = [
  {
    code: "government_id",
    label: "Form of identification",
    description: "A passport or driver's license to confirm your identity.",
    required: true,
  },
  {
    code: "accreditation_evidence",
    label: "Accreditation evidence",
    description: "Optional — a CPA/attorney letter or income proof. Boosts your Partner Score when verified.",
    required: false,
  },
];

export function kycChecklist(_investorType?: string | null): KycChecklistItem[] {
  return LIGHT_CHECKLIST;
}

export function isKycDocType(value: string, investorType?: string | null): value is KycDocType {
  return kycChecklist(investorType).some((item) => item.code === value);
}

export type KycChecklistState = {
  items: Array<KycChecklistItem & { uploaded: boolean; document: InvestorKycDocumentRecord | null }>;
  requiredTotal: number;
  requiredUploaded: number;
  missingRequired: KycChecklistItem[];
  canSubmit: boolean;
  percent: number;
};

/** Map the checklist against the investor's active uploads — no fabrication. */
export function computeKycChecklistState(
  investorType: string | null | undefined,
  documents: InvestorKycDocumentRecord[],
): KycChecklistState {
  const active = documents.filter((d) => d.status === "uploaded");
  const items = kycChecklist(investorType).map((item) => {
    const document = active.find((d) => d.doc_type === item.code) ?? null;
    return { ...item, uploaded: Boolean(document), document };
  });

  const required = items.filter((i) => i.required);
  const requiredUploaded = required.filter((i) => i.uploaded).length;
  const missingRequired = required.filter((i) => !i.uploaded);

  return {
    items,
    requiredTotal: required.length,
    requiredUploaded,
    missingRequired,
    canSubmit: missingRequired.length === 0,
    percent: required.length === 0 ? 100 : Math.round((requiredUploaded / required.length) * 100),
  };
}

export const KYC_STATUS_LABELS: Record<InvestorKycStatus, string> = {
  not_started: "Not started",
  pending: "Under review",
  verified: "Verified",
  rejected: "Action needed",
};

export function isInvestorKycVerified(
  status: InvestorKycStatus | string | null | undefined,
): boolean {
  return status === "verified";
}

export function buildKycStoragePath(
  investorProfileId: string,
  docType: string,
  fileName: string,
): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${investorProfileId}/${docType}/${crypto.randomUUID()}-${safe}`;
}

export async function listKycDocuments(
  investorProfileId: string,
): Promise<InvestorKycDocumentRecord[]> {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("investor_kyc_documents")
    .select("*")
    .eq("investor_profile_id", investorProfileId)
    .order("uploaded_at", { ascending: false });

  if (error) throw new Error(`Failed to list KYC documents: ${error.message}`);
  return (data ?? []) as InvestorKycDocumentRecord[];
}

/** Insert a KYC doc, archiving any prior active doc of the same type first. */
export async function saveKycDocument(input: {
  investorProfileId: string;
  docType: string;
  fileName: string;
  filePath: string;
  mimeType: string | null;
  sizeBytes: number | null;
}): Promise<InvestorKycDocumentRecord> {
  const admin = createServiceRoleClient();

  await admin
    .from("investor_kyc_documents")
    .update({ status: "archived" })
    .eq("investor_profile_id", input.investorProfileId)
    .eq("doc_type", input.docType)
    .neq("status", "archived");

  const { data, error } = await admin
    .from("investor_kyc_documents")
    .insert({
      investor_profile_id: input.investorProfileId,
      doc_type: input.docType,
      file_name: input.fileName,
      file_path: input.filePath,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
      status: "uploaded",
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to save KYC document.");
  return data as InvestorKycDocumentRecord;
}

export type KycReviewItem = {
  code: string;
  label: string;
  required: boolean;
  uploaded: boolean;
  fileName: string | null;
  signedUrl: string | null;
};

/** Build the per-investor KYC view (checklist + signed file links) for admins. */
export async function loadKycReviewView(
  investorProfileId: string,
  investorType: string | null,
): Promise<{ items: KycReviewItem[]; canSubmit: boolean }> {
  const docs = await listKycDocuments(investorProfileId);
  const state = computeKycChecklistState(investorType, docs);
  const items = await Promise.all(
    state.items.map(async (i): Promise<KycReviewItem> => {
      let signedUrl: string | null = null;
      if (i.document) {
        const { data } = await createKycSignedUrl(i.document.file_path);
        signedUrl = data?.signedUrl ?? null;
      }
      return {
        code: i.code,
        label: i.label,
        required: i.required,
        uploaded: i.uploaded,
        fileName: i.document?.file_name ?? null,
        signedUrl,
      };
    }),
  );
  return { items, canSubmit: state.canSubmit };
}

/** Short-lived signed URL for a private KYC file (admin/owner viewing). */
export async function createKycSignedUrl(filePath: string, expiresIn = 300) {
  const admin = createServiceRoleClient();
  return admin.storage.from(KYC_BUCKET).createSignedUrl(filePath, expiresIn);
}

/** Move the investor into the 'pending' KYC review queue, saving legal name + consent. */
export async function submitInvestorKyc(
  investorProfileId: string,
  opts: { legalName: string; consent: boolean },
): Promise<InvestorProfileRecord> {
  const admin = createServiceRoleClient();
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("investor_profiles")
    .update({
      kyc_status: "pending",
      kyc_submitted_at: now,
      kyc_feedback: null,
      legal_name: opts.legalName.trim(),
      kyc_consent: opts.consent,
      updated_at: now,
    })
    .eq("id", investorProfileId)
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to submit KYC for review.");
  return data as InvestorProfileRecord;
}

/** Admin decision on submitted KYC: verify (Stage 3 unlocked) or reject. */
export async function applyInvestorKycReview(input: {
  investorProfileId: string;
  adminId: string;
  action: "verify" | "reject";
  feedback?: string | null;
}): Promise<InvestorProfileRecord> {
  const admin = createServiceRoleClient();
  const now = new Date().toISOString();
  const kyc_status: InvestorKycStatus = input.action === "verify" ? "verified" : "rejected";

  const { data, error } = await admin
    .from("investor_profiles")
    .update({
      kyc_status,
      kyc_feedback: input.feedback?.trim() || null,
      kyc_reviewed_at: now,
      kyc_reviewed_by: input.adminId,
      updated_at: now,
    })
    .eq("id", input.investorProfileId)
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to record KYC review.");
  return data as InvestorProfileRecord;
}

/** Admin marks the investor's optional accreditation evidence verified / not. */
export async function applyAccreditationReview(
  investorProfileId: string,
  adminId: string,
  verified: boolean,
): Promise<InvestorProfileRecord> {
  const admin = createServiceRoleClient();
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("investor_profiles")
    .update({
      accreditation_verified: verified,
      accreditation_reviewed_at: verified ? now : null,
      accreditation_reviewed_by: verified ? adminId : null,
      updated_at: now,
    })
    .eq("id", investorProfileId)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to record accreditation review.");
  return data as InvestorProfileRecord;
}

/**
 * Where an investor sits in the three-stage journey:
 * Onboard (profile approval) → Verify (KYC) → Access.
 */
export type InvestorStageKey = "onboard" | "verify" | "access";

export function deriveInvestorStage(record: InvestorProfileRecord): {
  stage: InvestorStageKey;
  kycStatus: InvestorKycStatus;
} {
  if (record.approval_status !== "approved") {
    return { stage: "onboard", kycStatus: record.kyc_status };
  }
  if (record.kyc_status === "verified") {
    return { stage: "access", kycStatus: record.kyc_status };
  }
  return { stage: "verify", kycStatus: record.kyc_status };
}
