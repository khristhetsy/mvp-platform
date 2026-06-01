import type { AuditComplianceFilters, AuditEvidenceEntityType, AuditTimelineEntry } from "@/lib/audit-compliance/types";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export function parseAuditComplianceFilters(params: URLSearchParams): AuditComplianceFilters {
  return {
    companyId: params.get("company") ?? params.get("companyId") ?? undefined,
    investorId: params.get("investor") ?? params.get("investorId") ?? undefined,
    investorProfileId: params.get("investorProfile") ?? undefined,
    spvId: params.get("spv") ?? params.get("spvId") ?? undefined,
    userId: params.get("user") ?? params.get("userId") ?? undefined,
    eventType: params.get("eventType") ?? undefined,
    severity: params.get("severity") ?? undefined,
    status: params.get("status") ?? undefined,
    dateFrom: params.get("from") ?? undefined,
    dateTo: params.get("to") ?? undefined,
    sourceModule: params.get("module") ?? params.get("sourceModule") ?? undefined,
    limit: Math.min(Number(params.get("limit") ?? DEFAULT_LIMIT), MAX_LIMIT),
  };
}

export function applyAuditTimelineFilters(
  entries: AuditTimelineEntry[],
  filters: AuditComplianceFilters,
): AuditTimelineEntry[] {
  let result = entries;

  if (filters.companyId) {
    result = result.filter((e) => e.companyId === filters.companyId);
  }
  if (filters.investorId) {
    result = result.filter(
      (e) => e.investorId === filters.investorId || e.actorUserId === filters.investorId,
    );
  }
  if (filters.investorProfileId) {
    result = result.filter((e) => e.entityId === filters.investorProfileId && e.entityType === "investor");
  }
  if (filters.spvId) {
    result = result.filter((e) => e.spvId === filters.spvId);
  }
  if (filters.userId) {
    result = result.filter((e) => e.actorUserId === filters.userId);
  }
  if (filters.eventType) {
    const needle = filters.eventType.toLowerCase();
    result = result.filter((e) => e.eventType.toLowerCase().includes(needle));
  }
  if (filters.severity) {
    result = result.filter((e) => e.severity === filters.severity);
  }
  if (filters.status) {
    result = result.filter((e) => e.status === filters.status);
  }
  if (filters.sourceModule) {
    const needle = filters.sourceModule.toLowerCase();
    result = result.filter((e) => e.sourceModule.toLowerCase().includes(needle));
  }
  if (filters.dateFrom) {
    const from = new Date(filters.dateFrom).getTime();
    result = result.filter((e) => new Date(e.createdAt).getTime() >= from);
  }
  if (filters.dateTo) {
    const end = new Date(filters.dateTo);
    end.setUTCHours(23, 59, 59, 999);
    const to = end.getTime();
    result = result.filter((e) => new Date(e.createdAt).getTime() <= to);
  }

  const limit = filters.limit ?? DEFAULT_LIMIT;
  return result.slice(0, limit);
}

export function auditEntityHref(entityType: AuditEvidenceEntityType | string, entityId: string): string {
  if (entityType === "company") return `/admin/audit?company=${entityId}`;
  if (entityType === "investor") return `/admin/audit?investorProfile=${entityId}`;
  if (entityType === "spv") return `/admin/audit?spv=${entityId}`;
  return `/admin/audit`;
}
