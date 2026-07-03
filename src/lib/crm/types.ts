// Admin CRM console — adapted types. v1 sources everything from Supabase
// (Odoo integration + the indicated_interests relationship layer are deferred).

export type CrmModule = "founder" | "investor";
export type CrmView = "list" | "board" | "cards";

export type FounderStage = "onboard" | "building" | "ready" | "raise" | "closed";
export type InvestorRel = "lead" | "profiled" | "active" | "allocating";
export type InterestLevel = "watching" | "soft" | "indicated" | "advancing" | "passed";

export const FOUNDER_STAGES: { key: FounderStage; label: string }[] = [
  { key: "onboard", label: "Onboarding" },
  { key: "building", label: "Readiness-building" },
  { key: "ready", label: "Raise-ready" },
  { key: "raise", label: "Active raise" },
  { key: "closed", label: "Closed" },
];

export const INVESTOR_RELS: { key: InvestorRel; label: string }[] = [
  { key: "lead", label: "Lead" },
  { key: "profiled", label: "Profiled" },
  { key: "active", label: "Active" },
  { key: "allocating", label: "Allocating" },
];

/** Contact detail + Odoo profile, surfaced in the detail drawer. */
export interface ContactDetails {
  email: string | null;
  phone: string | null;
  website: string | null;
  title: string | null; // job title / function
  company: string | null;
  location: string | null;
  description: string | null; // notes
  leadSource: string | null;
  membership: string | null;
  profile: { label: string; values: string[] }[];
}

export interface FounderRecord {
  id: string;
  name: string;
  raiseLabel: string;
  stage: FounderStage;
  readiness: {
    score: number;
    scoreKind: "crr" | "lead_prescore";
  };
  plan: string;
  ownerInitials: string;
  lastActivity: string; // ISO
  details?: ContactDetails;
}

export interface InvestorRecord {
  id: string;
  name: string;
  kind: string;
  fit: number;
  kyc: "Verified" | "Pending" | "None";
  rel: InvestorRel;
  mandate: string[];
  indicatedCount: number;
  ownerInitials: string;
  lastActivity: string; // ISO
  details?: ContactDetails;
}

export interface MatchRow {
  name: string;
  context: string;
  fit: number;
  interest: InterestLevel;
}

/** Internal CRM annotation, editable and stored separately from the Odoo mirror. */
export interface CrmAnnotation {
  owner: string | null;
  status: string | null;
  tags: string[];
  notes: string | null;
  updatedAt: string | null;
}

export const CRM_INTERNAL_STATUSES = [
  "New",
  "Contacted",
  "Engaged",
  "Qualified",
  "Nurture",
  "Archived",
] as const;

/** Full single-contact record for the expanded record page. */
export interface ContactFull {
  externalId: string;
  module: CrmModule | "unknown";
  name: string;
  subtitle: string;
  score: number;
  scoreKind: "crr" | "lead_prescore" | "fit";
  ownerInitials: string;
  lastActivity: string; // ISO
  details: ContactDetails;
  rawFields: { label: string; value: string }[];
}

/** A mirrored contact with no founder/investor membership yet. */
export interface UnclassifiedRecord {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  membership: string | null; // raw Odoo member type, if any (e.g. "Advisor")
  signals: string[]; // profile hints found (investor types, industries, etc.)
  leadSource: string | null;
  lastActivity: string; // ISO
}
