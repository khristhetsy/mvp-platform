import type { InternalPermission } from "@/lib/rbac/constants";

/** The 14 parts of the Admin Operations Manual. */
export type SopPartId =
  | "A" | "B" | "C" | "D" | "E" | "F" | "G"
  | "H" | "I" | "J" | "K" | "L" | "M" | "N";

export interface SopPart {
  id: SopPartId;
  title: string;
}

/**
 * One Standard Operating Procedure. This is the single source of truth — the
 * /admin/manual page renders these, and the assistant retrieves and quotes from
 * them. Keep `steps` accurate to the real product; a runbook with wrong steps is
 * worse than none.
 */
export interface SopEntry {
  /** Stable 1..N id. Drives the anchor: sop-07 → #sop-07. */
  id: number;
  part: SopPartId;
  title: string;
  /** One-line purpose, shown in nav and quoted by the assistant. */
  summary: string;
  /**
   * RBAC permission required to PERFORM this procedure. null = general staff
   * knowledge (everyone in admin/analyst may read and act).
   */
  permission: InternalPermission | null;
  /** Hidden entirely from anyone who is not a super admin (sensitive security). */
  superAdminOnly?: boolean;
  /** The backing feature is not built yet — shown as "planned". */
  planned?: boolean;
  /** Retrieval keywords (lowercased matched against the user's message). */
  keywords: string[];
  steps: string[];
  behindScenes?: string;
  reversibility?: string;
  warnings?: string[];
}

/** A viewer's effective access, used to gate what they see. */
export interface SopViewer {
  permissions: InternalPermission[];
  isSuperAdmin: boolean;
}

/** Result of resolving one SOP against a viewer. */
export interface SopVisibility {
  /** Shown at all (super-admin-only entries are invisible to others). */
  visible: boolean;
  /** Visible but the viewer lacks permission to perform it (show-but-locked). */
  locked: boolean;
}

export const SOP_PARTS: SopPart[] = [
  { id: "A", title: "Account & access lifecycle" },
  { id: "B", title: "Subscriptions, billing & feature access" },
  { id: "C", title: "Founder workflow administration" },
  { id: "D", title: "Investor workflow administration" },
  { id: "E", title: "SPV operations" },
  { id: "F", title: "Compliance & risk" },
  { id: "G", title: "Communications" },
  { id: "H", title: "Learning administration" },
  { id: "I", title: "Platform operations" },
  { id: "J", title: "Security & incident response" },
  { id: "K", title: "Data & privacy" },
  { id: "L", title: "Staff governance" },
  { id: "M", title: "Release & deployment" },
  { id: "N", title: "Trust, safety & support" },
];

/** Canonical anchor for an SOP, e.g. 7 → "sop-07". */
export function sopAnchor(id: number): string {
  return `sop-${String(id).padStart(2, "0")}`;
}
