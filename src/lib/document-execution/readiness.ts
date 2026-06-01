import { complianceBlockReason, isExecutionBlockedByCompliance } from "@/lib/document-execution/compliance-checks";
import {
  EXECUTION_PACKAGE_DEFINITIONS,
  findLinkedPackage,
  isPackageExecutionReady,
} from "@/lib/document-execution/package-mapping";
import { computeSignerReadiness, computeSignerReadinessPct } from "@/lib/document-execution/signer-readiness";
import type {
  ExecutionPackageReadiness,
  SpvExecutionReadinessSummary,
} from "@/lib/document-execution/types";
import { areRequiredParticipationRequirementsComplete } from "@/lib/spv/participation-display";
import type {
  SpvClosingReviewRecord,
  SpvDocumentPackageRecord,
  SpvOpportunityRecord,
  SpvParticipationRecord,
  SpvParticipationRequirementRecord,
} from "@/lib/spv/types";

export type SpvExecutionReadinessInput = {
  spv: SpvOpportunityRecord;
  packages: SpvDocumentPackageRecord[];
  participations: SpvParticipationRecord[];
  requirements: SpvParticipationRequirementRecord[];
  closingReview: SpvClosingReviewRecord | null;
  criticalComplianceOpenCount: number;
  hasFounderSigner: boolean;
};

function requirementsForCategories(
  requirements: SpvParticipationRequirementRecord[],
  categories: string[],
): SpvParticipationRequirementRecord[] {
  if (!categories.length) return [];
  return requirements.filter((r) => categories.includes(r.category));
}

function buildPackageReadiness(
  input: SpvExecutionReadinessInput,
  complianceBlocked: boolean,
): ExecutionPackageReadiness[] {
  return EXECUTION_PACKAGE_DEFINITIONS.map((def) => {
    if (def.placeholderOnly) {
      return {
        kind: def.kind,
        label: def.label,
        packageReady: false,
        packageStatus: null,
        blockedReason: "Placeholder for future side letters — not tracked in Phase 1",
        nextRequiredStep: "Define side letter terms outside CapitalOS when applicable",
        placeholderOnly: true,
      };
    }

    const linked = findLinkedPackage(input.packages, def.kind);
    const reqRows = requirementsForCategories(input.requirements, def.requirementCategories);
    const reqsComplete =
      def.requirementCategories.length === 0 ||
      (reqRows.length > 0 &&
        input.participations
          .filter((p) => !["declined", "canceled"].includes(p.status))
          .every((part) => {
            const partReqs = reqRows.filter((r) => r.spv_participation_id === part.id);
            return partReqs.length === 0 || areRequiredParticipationRequirementsComplete(partReqs);
          }));

    const packageReady = linked
      ? isPackageExecutionReady(linked.status)
      : def.requirementCategories.length > 0
        ? reqsComplete
        : false;

    let blockedReason: string | null = null;
    let nextRequiredStep = "Ready for future e-sign when DocuSign is connected";

    if (complianceBlocked) {
      blockedReason = complianceBlockReason(input.criticalComplianceOpenCount);
      nextRequiredStep = "Resolve critical compliance events";
    } else if (!linked && def.requirementCategories.length === 0) {
      blockedReason = "Operational package not created";
      nextRequiredStep = `Create or approve ${def.label} in SPV document packages`;
    } else if (linked && !isPackageExecutionReady(linked.status)) {
      blockedReason = `Package status: ${linked.status}`;
      nextRequiredStep = "Approve or issue package in admin SPV workspace";
    } else if (!reqsComplete) {
      blockedReason = "Investor requirement packet incomplete";
      nextRequiredStep = "Complete investor accreditation/KYC requirements";
    } else if (!packageReady) {
      blockedReason = "Execution prerequisites not met";
      nextRequiredStep = "Complete package and signer readiness";
    }

    return {
      kind: def.kind,
      label: def.label,
      packageReady,
      packageStatus: linked?.status ?? null,
      blockedReason,
      nextRequiredStep,
    };
  });
}

export function computeSpvExecutionReadiness(input: SpvExecutionReadinessInput): SpvExecutionReadinessSummary {
  const complianceBlocked = isExecutionBlockedByCompliance(input.criticalComplianceOpenCount);
  const packages = buildPackageReadiness(input, complianceBlocked);
  const signers = computeSignerReadiness({
    participations: input.participations,
    requirements: input.requirements,
    packages: input.packages,
    closingReview: input.closingReview,
    hasFounderSigner: input.hasFounderSigner,
  });

  const nonPlaceholder = packages.filter((p) => !p.placeholderOnly);
  const readyCount = nonPlaceholder.filter((p) => p.packageReady).length;
  const executionReadinessPct =
    nonPlaceholder.length > 0 ? Math.round((readyCount / nonPlaceholder.length) * 100) : 0;

  const signerReadinessPct = computeSignerReadinessPct(signers);
  const blockedPackages = packages.filter((p) => !p.packageReady && !p.placeholderOnly);

  const nextFromPackage = blockedPackages[0]?.nextRequiredStep;
  const nextFromSigner = signers.find((s) => s.status !== "present")?.blockedReason;
  const closingOk =
    input.closingReview?.status === "approved_for_closing" ||
    input.closingReview?.status === "closed_operationally";

  let nextRequiredStep = "All execution packages ready — await DocuSign connector (Phase 2)";
  if (complianceBlocked) {
    nextRequiredStep = complianceBlockReason(input.criticalComplianceOpenCount)!;
  } else if (!closingOk) {
    nextRequiredStep = "Complete closing review approval";
  } else if (nextFromPackage) {
    nextRequiredStep = nextFromPackage;
  } else if (nextFromSigner) {
    nextRequiredStep = nextFromSigner;
  }

  const readyForFutureEsign =
    executionReadinessPct >= 100 && signerReadinessPct >= 100 && closingOk && !complianceBlocked;

  return {
    spvId: input.spv.id,
    spvName: input.spv.name,
    companyId: input.spv.company_id,
    executionReadinessPct,
    signerReadinessPct,
    packages,
    signers,
    blockedPackages,
    nextRequiredStep,
    docusignStatus: "not_connected",
    docusignLabel: readyForFutureEsign
      ? "Ready for future e-sign (DocuSign not connected)"
      : "Not connected — complete readiness first",
    readyForFutureEsign,
    closingReviewStatus: input.closingReview?.status ?? null,
    complianceBlocked,
  };
}

export function computeExecutionReadinessBySpvMap(
  inputs: SpvExecutionReadinessInput[],
): Record<string, SpvExecutionReadinessSummary> {
  const out: Record<string, SpvExecutionReadinessSummary> = {};
  for (const input of inputs) {
    out[input.spv.id] = computeSpvExecutionReadiness(input);
  }
  return out;
}
