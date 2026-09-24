/**
 * Which "People" checkbox in the Duplicate event dialog a roster row belongs to.
 *
 * `event_presenters.role_label` is free text (see PresentersManager), so this
 * reuses the email roster's normaliser and groups, then splits panelists out of
 * the presenter group. Guest CEO and Investor are the talk-show line-up, so they
 * travel with Talk show guests. Anything unrecognised stays with Presenters,
 * matching the roster's rule that a person always lands somewhere.
 *
 * Pure on purpose, so the mapping is testable without a database.
 */

import { normalizeRole, roleGroupOf } from "@/lib/event-email/roster";

export type DuplicatePeopleRole = "presenters" | "exhibitors" | "talkShowGuests" | "panelists";

const PANELIST_LABELS = new Set(["panelist", "panellist", "panelists", "panellists", "moderator"]);

export function duplicateRoleOf(label: string | null | undefined): DuplicatePeopleRole {
  const raw = label ?? "";
  if (PANELIST_LABELS.has(normalizeRole(raw))) return "panelists";
  const group = roleGroupOf(raw);
  if (group === "exhibitor") return "exhibitors";
  if (group === "guest_ceo" || group === "investor") return "talkShowGuests";
  return "presenters";
}
