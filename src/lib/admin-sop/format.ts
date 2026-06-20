import { INTERNAL_PERMISSION_LABELS } from "@/lib/rbac/constants";
import { sopAnchor } from "./types";
import type { SopEntry } from "./types";

/** Deep link to a specific SOP in the manual page. */
export function sopHref(sop: SopEntry): string {
  return `/admin/manual#${sopAnchor(sop.id)}`;
}

/** Short permission label, or "general staff" when no permission is required. */
function permissionLabel(sop: SopEntry): string {
  if (!sop.permission) return "general staff";
  return INTERNAL_PERMISSION_LABELS[sop.permission] ?? sop.permission;
}

/**
 * Build a grounded assistant answer from a retrieved SOP. The text is the SOP's
 * own steps — no free generation — so the assistant cannot invent a procedure.
 * `locked` tailors the note when the viewer lacks permission to perform it.
 */
export function formatSopForAssistant(sop: SopEntry, locked: boolean): string {
  const lines: string[] = [];
  lines.push(`SOP ${sop.id} — ${sop.title}`);
  lines.push("");
  lines.push(sop.summary);

  if (sop.planned) {
    lines.push("");
    lines.push("Note: the backing feature for this is planned, not built yet — follow the interim steps below.");
  }

  lines.push("");
  lines.push("Steps:");
  sop.steps.forEach((step, i) => lines.push(`${i + 1}. ${step}`));

  if (sop.warnings && sop.warnings.length > 0) {
    lines.push("");
    lines.push("Watch out:");
    sop.warnings.forEach((w) => lines.push(`- ${w}`));
  }

  lines.push("");
  if (locked) {
    lines.push(
      `Heads up: performing this requires the ${permissionLabel(sop)} permission, which you don't currently have — you'll need to hand the action to someone who does.`,
    );
  } else {
    lines.push(`Permission to perform: ${permissionLabel(sop)}.`);
  }
  lines.push("Full procedure: open the operations manual via the link below.");

  return lines.join("\n");
}

/** Answer when the assistant has no confident SOP match. */
export function formatNoSopMatch(): string {
  return [
    "I don't have a specific SOP that matches that. Browse the operations manual for the full set of procedures, or rephrase — for example, \"how do I deactivate a user?\"",
  ].join("\n");
}
