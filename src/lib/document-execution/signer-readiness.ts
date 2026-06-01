import { areRequiredParticipationRequirementsComplete } from "@/lib/spv/participation-display";
import type { SignerReadiness, SignerType } from "@/lib/document-execution/types";
import type {
  SpvClosingReviewRecord,
  SpvDocumentPackageRecord,
  SpvParticipationRecord,
  SpvParticipationRequirementRecord,
} from "@/lib/spv/types";
import { isPackageExecutionReady } from "@/lib/document-execution/package-mapping";

const COMPLETE_PACKAGE_STATUSES = new Set(["approved", "issued", "archived"]);

export function computeSignerReadiness(input: {
  participations: SpvParticipationRecord[];
  requirements: SpvParticipationRequirementRecord[];
  packages: SpvDocumentPackageRecord[];
  closingReview: SpvClosingReviewRecord | null;
  hasFounderSigner: boolean;
}): SignerReadiness[] {
  const active = input.participations.filter((p) => !["declined", "canceled"].includes(p.status));

  const investorReady = active.filter((part) => {
    const reqs = input.requirements.filter((r) => r.spv_participation_id === part.id);
    return reqs.length > 0 && areRequiredParticipationRequirementsComplete(reqs);
  });

  const investorSigner: SignerReadiness = {
    signerType: "investor",
    label: "Investor signers",
    status:
      active.length === 0
        ? "missing"
        : investorReady.length === active.length
          ? "present"
          : investorReady.length > 0
            ? "partial"
            : "missing",
    presentCount: investorReady.length,
    requiredCount: active.length,
    blockedReason:
      active.length === 0
        ? "No active investor participations"
        : investorReady.length < active.length
          ? "Investor accreditation/KYC requirements incomplete"
          : null,
  };

  const packagesNeedingApproval = input.packages.filter((p) => !isPackageExecutionReady(p.status));
  const adminSigner: SignerReadiness = {
    signerType: "admin_reviewer",
    label: "Admin package approval",
    status:
      input.packages.length === 0
        ? "missing"
        : packagesNeedingApproval.length === 0
          ? "present"
          : "partial",
    presentCount: input.packages.filter((p) => COMPLETE_PACKAGE_STATUSES.has(p.status)).length,
    requiredCount: input.packages.length,
    blockedReason:
      input.packages.length === 0
        ? "Document packages not seeded"
        : packagesNeedingApproval.length > 0
          ? "One or more packages not approved/issued"
          : null,
  };

  const founderSigner: SignerReadiness = {
    signerType: "founder_signatory",
    label: "Founder / company signer",
    status: input.hasFounderSigner ? "present" : "missing",
    presentCount: input.hasFounderSigner ? 1 : 0,
    requiredCount: 1,
    blockedReason: input.hasFounderSigner ? null : "Company founder signer not linked",
  };

  const closingOk =
    input.closingReview?.status === "approved_for_closing" ||
    input.closingReview?.status === "closed_operationally";
  const closingSigner: SignerReadiness = {
    signerType: "closing_reviewer",
    label: "Closing review approval",
    status: closingOk ? "present" : input.closingReview ? "partial" : "missing",
    presentCount: closingOk ? 1 : 0,
    requiredCount: 1,
    blockedReason: closingOk
      ? null
      : input.closingReview
        ? `Closing review: ${input.closingReview.status}`
        : "Closing review not started",
  };

  return [investorSigner, adminSigner, founderSigner, closingSigner];
}

export function computeSignerReadinessPct(signers: SignerReadiness[]): number {
  if (!signers.length) return 0;
  const weights = signers.map((s) => {
    if (s.requiredCount === 0) return s.status === "present" ? 100 : 0;
    return Math.round((s.presentCount / s.requiredCount) * 100);
  });
  return Math.round(weights.reduce((a, b) => a + b, 0) / weights.length);
}
