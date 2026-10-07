/**
 * Calls placed from the platform also land on the investor's IR record, so the IR
 * dashboard's Calls card and the founder report count them.
 *
 * Sources: the Sales contact "Log call" route (crm contact id) and the Voice Hub
 * call-end writeback (Odoo partner id, matched on crm_contacts.external_id).
 *
 * One call is logged on ONE investor record. About 29% of investors sit on more than
 * one project, so writing to every record would count the same call several times.
 * Rule: pick the record on an active project that was worked most recently
 * (updated_at). Best-effort: never throws; returns the match id it logged on, or null.
 */
import { createActivity, db, updateMatch } from "@/lib/ir/db";
import { IR_STAGES, type IrStage } from "@/lib/ir/types";

const VOICEMAIL = /voicemail|\bvm\b|left (a )?message/i;
const NOT_REACHED = /no[_ ]?answer|wrong[_ ]?number|busy|failed|no[_ ]?response|unreachable|voicemail/i;

/** Activity type and whether a conversation happened, from a call outcome or disposition. */
export function callActivityFor(outcome: string): { type: "call" | "voicemail"; reached: boolean; label: string } {
  const label = outcome.replace(/_/g, " ").trim() || "call";
  return { type: VOICEMAIL.test(outcome) ? "voicemail" : "call", reached: !NOT_REACHED.test(outcome), label };
}

/** Stage a call moves an investor to: a conversation → Contacted; an unanswered attempt → Intro sent. Never backwards, never out of Passed. */
export function stageAfterCall(current: IrStage, reached: boolean): IrStage | null {
  if (current === "passed") return null;
  const target: IrStage = reached ? "contacted" : "intro_sent";
  return IR_STAGES.indexOf(target) > IR_STAGES.indexOf(current) ? target : null;
}

type MatchRow = { id: string; project_id: string; task_id: string | null; stage: IrStage; assignee_id: string | null; updated_at: string };

/** The record a call belongs on: active project, most recently worked. */
export function pickMatch(matches: MatchRow[], activeProjects: Set<string>): MatchRow | null {
  return matches.filter((m) => activeProjects.has(m.project_id)).sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0] ?? null;
}

export async function logIrCall(input: {
  crmContactId?: string | null; externalId?: string | null;
  outcome: string; duration?: string | null; notes?: string | null;
  source: "sales" | "voice"; actorId?: string | null;
}): Promise<string | null> {
  try {
    let ids: string[] = [];
    if (input.crmContactId) ids = [input.crmContactId];
    else if (input.externalId) {
      const { data } = await db().from("crm_contacts").select("id").eq("external_id", input.externalId).limit(5);
      ids = ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
    }
    if (!ids.length) return null;
    const { data: m } = await db().from("ir_matches").select("id, project_id, task_id, stage, assignee_id, updated_at").in("investor_contact_id", ids);
    const matches = (m ?? []) as MatchRow[];
    if (!matches.length) return null;
    const { data: p } = await db().from("ir_projects").select("id, status, owner_id").in("id", [...new Set(matches.map((x) => x.project_id))]);
    const projects = (p ?? []) as Array<{ id: string; status: string; owner_id: string }>;
    const match = pickMatch(matches, new Set(projects.filter((x) => x.status === "active").map((x) => x.id)));
    if (!match) return null;
    const owner = projects.find((x) => x.id === match.project_id)?.owner_id ?? null;
    const who = input.actorId ?? match.assignee_id ?? owner;
    if (!who) return null;

    const kind = callActivityFor(input.outcome);
    const label = kind.label.charAt(0).toUpperCase() + kind.label.slice(1);
    const outcome = [label, input.duration?.trim() || null, input.notes?.trim() ? `"${input.notes.trim()}"` : null, input.source === "voice" ? "Voice" : null].filter(Boolean).join(" · ");
    await createActivity({
      projectId: match.project_id, matchId: match.id, taskId: match.task_id,
      type: kind.type, subject: kind.type === "voicemail" ? "Left voicemail" : "Call", outcome: outcome.slice(0, 2000),
      doneAt: new Date().toISOString(), founderVisible: true, assigneeId: who, createdBy: who,
    });
    const next = stageAfterCall(match.stage, kind.reached);
    if (next) await updateMatch(match.id, { stage: next }, who);
    return match.id;
  } catch { return null; }
}
