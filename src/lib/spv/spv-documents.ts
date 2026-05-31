export const SPV_INVESTOR_DOCUMENTS_BUCKET = "spv-investor-documents";
export const SPV_REQUIREMENT_DOCUMENT_TYPE = "SPV_REQUIREMENT";

export function buildSpvRequirementStoragePath(
  investorId: string,
  requirementId: string,
  fileName: string,
) {
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${investorId}/${requirementId}/${Date.now()}-${safeFileName}`;
}

export const spvRequirementUploadMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
]);

export const spvRequirementMaxUploadBytes = 25 * 1024 * 1024;
