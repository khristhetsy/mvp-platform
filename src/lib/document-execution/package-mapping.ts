import type { ExecutionPackageKind } from "@/lib/document-execution/types";
import type { SpvDocumentPackageRecord, SpvDocumentPackageType } from "@/lib/spv/types";

export type ExecutionPackageDefinition = {
  kind: ExecutionPackageKind;
  label: string;
  linkedPackageType: SpvDocumentPackageType | null;
  placeholderOnly: boolean;
  requirementCategories: string[];
};

export const EXECUTION_PACKAGE_DEFINITIONS: ExecutionPackageDefinition[] = [
  {
    kind: "subscription_package",
    label: "Subscription package",
    linkedPackageType: "subscription_package",
    placeholderOnly: false,
    requirementCategories: ["subscription_docs"],
  },
  {
    kind: "operating_agreement",
    label: "Operating agreement",
    linkedPackageType: "formation_package",
    placeholderOnly: false,
    requirementCategories: [],
  },
  {
    kind: "investor_accreditation_packet",
    label: "Investor accreditation packet",
    linkedPackageType: "investor_intake_package",
    placeholderOnly: false,
    requirementCategories: ["accreditation"],
  },
  {
    kind: "kyc_aml_packet",
    label: "KYC / AML packet",
    linkedPackageType: null,
    placeholderOnly: false,
    requirementCategories: ["kyc_aml"],
  },
  {
    kind: "tax_documents",
    label: "Tax documents",
    linkedPackageType: "tax_package",
    placeholderOnly: false,
    requirementCategories: ["tax"],
  },
  {
    kind: "closing_packet",
    label: "Closing packet",
    linkedPackageType: "final_closing_package",
    placeholderOnly: false,
    requirementCategories: [],
  },
  {
    kind: "side_letter",
    label: "Side letter / special terms",
    linkedPackageType: null,
    placeholderOnly: true,
    requirementCategories: [],
  },
];

const COMPLETE_STATUSES = new Set(["approved", "issued", "archived"]);

export function findLinkedPackage(
  packages: SpvDocumentPackageRecord[],
  kind: ExecutionPackageKind,
): SpvDocumentPackageRecord | null {
  const def = EXECUTION_PACKAGE_DEFINITIONS.find((d) => d.kind === kind);
  if (!def?.linkedPackageType) return null;
  return packages.find((p) => p.package_type === def.linkedPackageType) ?? null;
}

export function isPackageExecutionReady(status: string | null | undefined): boolean {
  return Boolean(status && COMPLETE_STATUSES.has(status));
}

export function getExecutionPackageDefinition(kind: ExecutionPackageKind): ExecutionPackageDefinition {
  return EXECUTION_PACKAGE_DEFINITIONS.find((d) => d.kind === kind)!;
}
