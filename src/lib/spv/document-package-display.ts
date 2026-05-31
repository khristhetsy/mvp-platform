import type {
  SpvDocumentPackageRecord,
  SpvDocumentPackageStatus,
} from "@/lib/spv/types";

const COMPLETE_PACKAGE_STATUSES: SpvDocumentPackageStatus[] = ["approved", "issued", "archived"];

export function formatPackageTypeLabel(packageType: string) {
  return packageType.replace(/_/g, " ");
}

export function computePackageReadinessPct(packages: SpvDocumentPackageRecord[]) {
  if (packages.length === 0) {
    return 0;
  }
  const done = packages.filter((row) =>
    COMPLETE_PACKAGE_STATUSES.includes(row.status as SpvDocumentPackageStatus),
  ).length;
  return Math.round((done / packages.length) * 100);
}

export function computeInvestorPackagePublicStatus(
  packages: SpvDocumentPackageRecord[],
  cachedStatus: string | null | undefined,
) {
  if (packages.length === 0) {
    return cachedStatus ?? "Preparation pending";
  }

  const subscription = packages.find((row) => row.package_type === "subscription_package");
  if (subscription?.status === "issued") {
    return "Documents ready";
  }

  if (packages.every((row) => COMPLETE_PACKAGE_STATUSES.includes(row.status as SpvDocumentPackageStatus))) {
    return "Documents ready";
  }

  if (packages.some((row) => row.status === "under_review")) {
    return "Documents under review";
  }

  if (packages.some((row) => ["preparing", "not_started"].includes(row.status))) {
    return "Documents being prepared";
  }

  return "Preparation pending";
}

export function summarizeFounderPackageProgress(packages: SpvDocumentPackageRecord[]) {
  const complete = packages.filter((row) =>
    COMPLETE_PACKAGE_STATUSES.includes(row.status as SpvDocumentPackageStatus),
  ).length;

  return {
    complete,
    total: packages.length,
    readinessPct: computePackageReadinessPct(packages),
  };
}
