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
}

export interface MatchRow {
  name: string;
  context: string;
  fit: number;
  interest: InterestLevel;
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
