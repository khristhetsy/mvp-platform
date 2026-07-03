// iCapOS Voice — shared types + constants for the compliance foundation.
// Advisory-only language throughout: the pre-score raises engagement traction,
// never funding probability. No SPV / deal-structure terms in any surface.

export type VoiceChannel = "voice" | "sms" | "whatsapp";
export type ConsentType = "express" | "express_written";
export type CampaignAudience = "founder" | "investor";
export type CampaignStatus = "draft" | "active" | "paused" | "archived";

/** Reasons pre_dial_gate() / preDialGate() can block a dial. */
export type GateBlockReason =
  | "system_disabled"   // feature flag off (dormant)
  | "no_phone"
  | "no_consent"        // consent-closed default
  | "jurisdiction_blocked" // EU/FR hard-block
  | "dnc"
  | "attempt_cap"       // two-call cap
  | "no_timezone"
  | "outside_hours";    // recipient-local 8am–9pm

export const GATE_REASON_LABEL: Record<GateBlockReason | "ok", string> = {
  ok: "Eligible",
  system_disabled: "Outbound disabled (dormant)",
  no_phone: "No phone number",
  no_consent: "No live consent",
  jurisdiction_blocked: "Jurisdiction blocked (EU/FR)",
  dnc: "On do-not-call list",
  attempt_cap: "Two-call cap reached",
  no_timezone: "No recipient timezone",
  outside_hours: "Outside 8am–9pm local",
};

export interface GateResult {
  eligible: boolean;
  reason: GateBlockReason | "ok";
  phone?: string;
  disclosure?: string;
}

export interface ConsentRecord {
  id: string;
  contactId: string;
  phone: string | null;
  channel: VoiceChannel;
  consentType: ConsentType;
  source: string | null;
  jurisdiction: string | null;
  callTimezone: string | null;
  capturedAt: string;
  expiresAt: string | null;
  evidenceUrl: string | null;
  revokedAt: string | null;
}

export interface DncEntry {
  id: string;
  number: string;
  scope: "all" | "voice" | "sms" | "whatsapp";
  reason: string | null;
  addedAt: string;
}

export interface ConsentLedgerSummary {
  consentRecords: number;
  liveConsents: number;
  revoked: number;
  onDnc: number;
  dialableNow: number;
}

/** The AI disclosure that must fire at call open, before anything else. */
export const AI_DISCLOSURE =
  "This is an automated AI assistant calling on behalf of iCFO Capital. This call may be recorded.";

/** Jurisdictions hard-blocked pending a dedicated consent flow (EU AI Act + GDPR). */
export const HARD_BLOCKED_JURISDICTIONS = ["EU", "FR"] as const;
