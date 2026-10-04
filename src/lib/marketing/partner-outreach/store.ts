/**
 * Partner outreach sequences: database access. Admin API routes call these
 * after checking the role. Partner enrollments live in their own table, so the
 * email sequence runner and its approval batches never touch them.
 */
import { marketingDb } from "../db";
import { sendMarketingEmail, makeUnsubscribeToken, emailConfigured } from "../send";
import { isUnsubscribed } from "../contacts";
import { getMarketingSettings } from "../settings";
import {
  PARTNER_STEPS, stepDueAt, readConfig, activationBlockers, emailForStep, bodyToHtml, stageStopsSteps,
  TIER_DEFAULT_TRACK,
  type PartnerConfig, type PartnerSender, type PartnerStage, type PartnerTier, type PartnerTrack, type PartnerRating,
} from "./config";

export type PartnerSequence = {
  id: string;
  name: string;
  status: "draft" | "active" | "paused" | "archived";
  department: string | null;
  approver_id: string | null;
  created_at: string;
  config: PartnerConfig;
};

export type PartnerEnrollment = {
  id: string;
  sequence_id: string;
  crm_contact_id: string | null;
  name: string;
  firm: string | null;
  email: string | null;
  phone: string | null;
  tier: PartnerTier;
  track: PartnerTrack;
  rating: PartnerRating;
  evidence: string | null;
  subject: string | null;
  body: string | null;
  stage: PartnerStage;
  stop_reason: string | null;
  current_step: number;
  started_at: string | null;
  next_due_at: string | null;
  history: Array<{ at: string; step: string; result: string; by?: string | null; error?: string }>;
  created_at: string;
};

const ENROLLMENT_COLS =
  "id, sequence_id, crm_contact_id, name, firm, email, phone, tier, track, rating, evidence, subject, body, stage, stop_reason, current_step, started_at, next_due_at, history, created_at";

export async function senderDefaults(): Promise<PartnerSender> {
  const s = await getMarketingSettings().catch(() => null);
  return {
    from_name: "Khris Thetsy",
    from_email: s?.default_from_email || "outreach@icapos.com",
    reply_to: s?.default_reply_to || "kthetsy@myicfos.com",
  };
}

function toSequence(row: Record<string, unknown>, defaults: PartnerSender): PartnerSequence {
  return {
    id: row.id as string,
    name: row.name as string,
    status: row.status as PartnerSequence["status"],
    department: (row.department as string | null) ?? null,
    approver_id: (row.approver_id as string | null) ?? null,
    created_at: row.created_at as string,
    config: readConfig(row.partner_config, defaults),
  };
}

export async function createPartnerSequence(name: string, createdBy: string, department: string | null): Promise<PartnerSequence> {
  const db = marketingDb();
  const defaults = await senderDefaults();
  const { data, error } = await db.from("marketing_sequences")
    .insert({ name, kind: "partner", created_by: createdBy, department, partner_config: { sender: defaults } })
    .select("*").single();
  if (error) throw error;
  return toSequence(data, defaults);
}

export async function getPartnerSequence(id: string): Promise<PartnerSequence | null> {
  const db = marketingDb();
  const { data } = await db.from("marketing_sequences").select("*").eq("id", id).eq("kind", "partner").maybeSingle();
  return data ? toSequence(data, await senderDefaults()) : null;
}

export async function listPartnerEnrollments(sequenceId: string): Promise<PartnerEnrollment[]> {
  const db = marketingDb();
  const { data, error } = await db.from("marketing_partner_enrollments").select(ENROLLMENT_COLS)
    .eq("sequence_id", sequenceId).order("tier").order("rating", { ascending: false }).order("name");
  if (error) throw error;
  return (data ?? []) as PartnerEnrollment[];
}

export async function updatePartnerSequence(id: string, patch: { name?: string; department?: string | null; config?: PartnerConfig }): Promise<void> {
  const db = marketingDb();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) update.name = patch.name.trim();
  if (patch.department !== undefined) update.department = patch.department;
  if (patch.config !== undefined) update.partner_config = patch.config;
  const { error } = await db.from("marketing_sequences").update(update).eq("id", id).eq("kind", "partner");
  if (error) throw error;
}

/** Go live: check the offer, then start every partner who has not started yet. */
export async function activatePartnerSequence(id: string): Promise<{ started: number; blockers: string[] }> {
  const seq = await getPartnerSequence(id);
  if (!seq) throw new Error("Sequence not found.");
  const blockers = activationBlockers(seq.config);
  if (blockers.length) return { started: 0, blockers };
  const db = marketingDb();
  const now = new Date().toISOString();
  const { error } = await db.from("marketing_sequences").update({ status: "active", updated_at: now }).eq("id", id);
  if (error) throw error;
  const { data } = await db.from("marketing_partner_enrollments")
    .update({ started_at: now, next_due_at: now, updated_at: now })
    .eq("sequence_id", id).eq("stage", "enrolled").is("started_at", null).select("id");
  return { started: (data ?? []).length, blockers: [] };
}

export async function setPartnerSequenceStatus(id: string, status: "paused" | "archived" | "draft"): Promise<void> {
  const db = marketingDb();
  const { error } = await db.from("marketing_sequences").update({ status, updated_at: new Date().toISOString() }).eq("id", id).eq("kind", "partner");
  if (error) throw error;
}

export type NewPartner = {
  crm_contact_id: string | null; name: string; firm?: string | null; email?: string | null; phone?: string | null;
  tier: PartnerTier; track?: PartnerTrack; rating?: PartnerRating; evidence?: string | null;
};

/** Add partners. Ones already in this sequence (same contact or email) are skipped. */
export async function addPartners(sequenceId: string, partners: NewPartner[], createdBy: string): Promise<{ added: number; skipped: number }> {
  const db = marketingDb();
  const { data: seq } = await db.from("marketing_sequences").select("status").eq("id", sequenceId).maybeSingle();
  const live = seq?.status === "active";
  const existing = await listPartnerEnrollments(sequenceId);
  const haveContact = new Set(existing.map((e) => e.crm_contact_id).filter(Boolean));
  const haveEmail = new Set(existing.map((e) => e.email?.toLowerCase()).filter(Boolean));
  const now = new Date().toISOString();
  const rows: Record<string, unknown>[] = [];
  let skipped = 0;
  for (const p of partners) {
    const email = p.email?.trim().toLowerCase() || null;
    if ((p.crm_contact_id && haveContact.has(p.crm_contact_id)) || (email && haveEmail.has(email))) { skipped++; continue; }
    if (p.crm_contact_id) haveContact.add(p.crm_contact_id);
    if (email) haveEmail.add(email);
    rows.push({
      sequence_id: sequenceId, crm_contact_id: p.crm_contact_id, name: p.name.trim(), firm: p.firm ?? null,
      email, phone: p.phone ?? null, tier: p.tier, track: p.track ?? TIER_DEFAULT_TRACK[p.tier],
      rating: p.rating ?? "strong", evidence: p.evidence ?? null, created_by: createdBy,
      ...(live ? { started_at: now, next_due_at: now } : {}),
    });
  }
  if (rows.length) {
    const { error } = await db.from("marketing_partner_enrollments").insert(rows);
    if (error) throw error;
  }
  return { added: rows.length, skipped };
}

export type EnrollmentPatch = Partial<Pick<PartnerEnrollment, "stage" | "stop_reason" | "subject" | "body" | "tier" | "track" | "rating" | "email" | "phone">>;

export async function updateEnrollment(sequenceId: string, enrollmentId: string, patch: EnrollmentPatch): Promise<void> {
  const db = marketingDb();
  const update: Record<string, unknown> = { ...patch, updated_at: new Date().toISOString() };
  if (patch.email !== undefined) update.email = patch.email?.trim().toLowerCase() || null;
  // Leaving a stop stage back to "enrolled" resumes from the next pending step.
  if (patch.stage === "enrolled") { update.stop_reason = null; update.next_due_at = new Date().toISOString(); }
  else if (patch.stage && stageStopsSteps(patch.stage)) update.next_due_at = null;
  const { error } = await db.from("marketing_partner_enrollments").update(update).eq("id", enrollmentId).eq("sequence_id", sequenceId);
  if (error) throw error;
}

export async function removeEnrollment(sequenceId: string, enrollmentId: string): Promise<void> {
  const db = marketingDb();
  const { error } = await db.from("marketing_partner_enrollments").delete().eq("id", enrollmentId).eq("sequence_id", sequenceId);
  if (error) throw error;
}

export type RunAction = "send" | "done" | "skip";

/**
 * Run the partner's current step: send its email, mark its task done, or skip it.
 * A failed send is logged and the step stays due so it can be retried.
 */
export async function runStep(sequenceId: string, enrollmentId: string, action: RunAction, actorId: string): Promise<{ ok: boolean; message: string }> {
  const db = marketingDb();
  const seq = await getPartnerSequence(sequenceId);
  if (!seq) throw new Error("Sequence not found.");
  if (seq.status !== "active") return { ok: false, message: "Activate the sequence first." };
  const { data: row } = await db.from("marketing_partner_enrollments").select(ENROLLMENT_COLS).eq("id", enrollmentId).eq("sequence_id", sequenceId).maybeSingle();
  const e = row as PartnerEnrollment | null;
  if (!e) throw new Error("Partner not found.");
  if (stageStopsSteps(e.stage)) return { ok: false, message: "This partner is no longer getting steps." };
  const step = PARTNER_STEPS[e.current_step];
  if (!step) return { ok: false, message: "All steps are done." };

  const now = new Date();
  const history = [...(e.history ?? [])];
  let result: string = action === "skip" ? "skipped" : "done";

  if (action === "send") {
    if (step.channel !== "email") return { ok: false, message: "This step is a task. Mark it done instead." };
    if (!e.email) return { ok: false, message: "No email on file. Skip this step or add an address." };
    if (!emailConfigured()) return { ok: false, message: "Email sending is not configured." };
    if (await isUnsubscribed(e.email)) {
      await db.from("marketing_partner_enrollments").update({
        stage: "stopped", stop_reason: "unsubscribed", next_due_at: null, updated_at: now.toISOString(),
        history: [...history, { at: now.toISOString(), step: step.key, result: "unsubscribed", by: actorId }],
      }).eq("id", e.id);
      return { ok: false, message: "This partner unsubscribed, so they were stopped." };
    }
    const mail = emailForStep(e.current_step, e, seq.config.offer)!;
    const sent = await sendMarketingEmail({
      to: e.email, first_name: null, company: e.firm,
      from_name: seq.config.sender.from_name, from_email: seq.config.sender.from_email,
      reply_to: seq.config.sender.reply_to || null,
      subject: mail.subject, html_body: bodyToHtml(mail.body), text_body: mail.body,
      unsubscribe_token: makeUnsubscribeToken(e.email),
    });
    if (!sent.ok) {
      history.push({ at: now.toISOString(), step: step.key, result: "failed", by: actorId, error: sent.error ?? "Send failed" });
      await db.from("marketing_partner_enrollments").update({ history, updated_at: now.toISOString() }).eq("id", e.id);
      return { ok: false, message: sent.error ?? "Send failed." };
    }
    result = "sent";
  } else if (action === "done" && step.channel !== "task") {
    return { ok: false, message: "This step is an email. Send or skip it." };
  }

  history.push({ at: now.toISOString(), step: step.key, result, by: actorId });
  const next = e.current_step + 1;
  const startedAt = e.started_at ? new Date(e.started_at) : now;
  const due = stepDueAt(startedAt, next);
  await db.from("marketing_partner_enrollments").update({
    current_step: next, history, updated_at: now.toISOString(),
    // A late step never pulls the next one into the past.
    next_due_at: due ? new Date(Math.max(due.getTime(), now.getTime())).toISOString() : null,
  }).eq("id", e.id);
  return { ok: true, message: result === "sent" ? `Sent to ${e.email}.` : result === "skipped" ? "Skipped." : "Marked done." };
}

/** Send every email step for one partner to a test address, marked [TEST]. Changes nothing. */
export async function sendPartnerTest(sequenceId: string, enrollmentId: string, testEmail: string): Promise<{ sent: number; failed: number }> {
  const seq = await getPartnerSequence(sequenceId);
  if (!seq) throw new Error("Sequence not found.");
  const db = marketingDb();
  const { data: row } = await db.from("marketing_partner_enrollments").select(ENROLLMENT_COLS).eq("id", enrollmentId).eq("sequence_id", sequenceId).maybeSingle();
  const e = row as PartnerEnrollment | null;
  if (!e) throw new Error("Partner not found.");
  let sent = 0, failed = 0;
  for (let i = 0; i < PARTNER_STEPS.length; i++) {
    const mail = emailForStep(i, e, seq.config.offer);
    if (!mail) continue;
    const r = await sendMarketingEmail({
      to: testEmail, first_name: null, company: e.firm,
      from_name: seq.config.sender.from_name, from_email: seq.config.sender.from_email, reply_to: seq.config.sender.reply_to || null,
      subject: `[TEST · ${PARTNER_STEPS[i].label}] ${mail.subject}`, html_body: bodyToHtml(mail.body), text_body: mail.body,
      unsubscribe_token: makeUnsubscribeToken(testEmail),
    });
    if (r.ok) sent++; else failed++;
  }
  return { sent, failed };
}

export type ContactHit = { id: string; name: string; company: string | null; email: string | null; phone: string | null; contact_type: string | null };

/** Contacts search for "Add partners": name or email, a short page only. */
export async function searchContactsForPartners(q: string): Promise<ContactHit[]> {
  const term = q.trim().replace(/[%,()]/g, " ").trim();
  if (term.length < 2) return [];
  const db = marketingDb();
  const { data } = await db.from("crm_contacts").select("id, name, company, email, phone, contact_type")
    .or(`name.ilike.%${term}%,email.ilike.%${term}%,company.ilike.%${term}%`)
    .not("suppressed", "is", true).limit(12);
  return (data ?? []) as ContactHit[];
}
