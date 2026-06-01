import type { SpvClosingReviewStatus, SpvDocumentPackageStatus } from "@/lib/spv/types";

export const EXECUTION_PACKAGE_KINDS = [
  "subscription_package",
  "operating_agreement",
  "investor_accreditation_packet",
  "kyc_aml_packet",
  "tax_documents",
  "closing_packet",
  "side_letter",
] as const;

export type ExecutionPackageKind = (typeof EXECUTION_PACKAGE_KINDS)[number];

export type DocuSignConnectionStatus = "not_connected" | "ready_for_future_esign";

export type SignerType = "investor" | "admin_reviewer" | "founder_signatory" | "closing_reviewer";

export type SignerReadinessStatus = "present" | "missing" | "partial";

export type ExecutionPackageReadiness = {
  kind: ExecutionPackageKind;
  label: string;
  packageReady: boolean;
  packageStatus: SpvDocumentPackageStatus | string | null;
  blockedReason: string | null;
  nextRequiredStep: string;
  placeholderOnly?: boolean;
};

export type SignerReadiness = {
  signerType: SignerType;
  label: string;
  status: SignerReadinessStatus;
  presentCount: number;
  requiredCount: number;
  blockedReason: string | null;
};

export type SpvExecutionReadinessSummary = {
  spvId: string;
  spvName: string;
  companyId: string;
  executionReadinessPct: number;
  signerReadinessPct: number;
  packages: ExecutionPackageReadiness[];
  signers: SignerReadiness[];
  blockedPackages: ExecutionPackageReadiness[];
  nextRequiredStep: string;
  docusignStatus: DocuSignConnectionStatus;
  docusignLabel: string;
  readyForFutureEsign: boolean;
  closingReviewStatus: SpvClosingReviewStatus | string | null;
  complianceBlocked: boolean;
};
