/** Canonical list of document types the platform requires for a complete diligence package. */
export const requiredDocumentTypes = [
  "Pitch deck",
  "Financial model",
  "Cap table",
  "Business plan",
  "Team bios",
  "Legal documents",
  "Corporate documents",
  "Customer contracts",
  "Market research",
] as const;

export type RequiredDocumentType = (typeof requiredDocumentTypes)[number];
