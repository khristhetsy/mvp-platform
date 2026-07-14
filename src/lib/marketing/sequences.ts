import { marketingDb } from "./db";
import { makeUnsubscribeToken, sendMarketingEmail, emailConfigured } from "./send";
import { isUnsubscribed } from "./contacts";
import type { MarketingSequence, MarketingSequenceStep } from "./types";

export async function getSequences(): Promise<MarketingSequence[]> {
  const db = await marketingDb();
  const { data, error } = await db
    .from("marketing_sequences")
    .select(`
      *,
      steps:marketing_sequence_steps(*, template:marketing_templates(id, name, subject))
    `)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MarketingSequence[];
}

export async function createSequence(name: string, createdBy?: string): Promise<MarketingSequence> {
  const db = await marketingDb();
  const { data, error } = await db
    .from("marketing_sequences")
    .insert({ name, ...(createdBy ? { created_by: createdBy } : {}) })
    .select()
    .single();
  if (error) throw error;
  return data as MarketingSequence;
}

export async function updateSequenceStatus(
  id: string,
  status: MarketingSequence["status"]
): Promise<void> {
  const db = await marketingDb();
  const { error } = await db
    .from("marketing_sequences")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function setSequenceApprover(sequenceId: string, approverId: string | null): Promise<void> {
  const db = await marketingDb();
  const { error } = await db
    .from("marketing_sequences")
    .update({ approver_id: approverId, updated_at: new Date().toISOString() })
    .eq("id", sequenceId);
  if (error) throw error;
}

export interface Approver { id: string; name: string }

/** Eligible approvers = internal staff + super admins (release stays permission-gated). */
export async function listApprovers(): Promise<Approver[]> {
  const db = await marketingDb();
  const { data } = await db
    .from("profiles")
    .select("id, full_name, email, role, is_super_admin")
    .or("role.in.(admin,analyst),is_super_admin.eq.true")
    .order("full_name");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((p) => ({ id: p.id, name: p.full_name || p.email || "User" }));
}

export async function addSequenceStep(
  input: Omit<MarketingSequenceStep, "id" | "created_at" | "template">
): Promise<MarketingSequenceStep> {
  const db = await marketingDb();
  const { data, error } = await db
    .from("marketing_sequence_steps")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as MarketingSequenceStep;
}

export async function updateSequenceStep(
  stepId: string,
  patch: Partial<Pick<MarketingSequenceStep, "template_id" | "condition" | "delay_days" | "from_name" | "from_email" | "step_order">>,
): Promise<MarketingSequenceStep> {
  const db = await marketingDb();
  const { data, error } = await db
    .from("marketing_sequence_steps")
    .update(patch)
    .eq("id", stepId)
    .select()
    .single();
  if (error) throw error;
  return data as MarketingSequenceStep;
}

export async function deleteSequenceStep(stepId: string): Promise<void> {
  const db = await marketingDb();
  const { error } = await db.from("marketing_sequence_steps").delete().eq("id", stepId);
  if (error) throw error;
}

/** Permanently delete a sequence. Steps, enrollments, batches, and events cascade. */
export async function deleteSequence(sequenceId: string): Promise<void> {
  const db = await marketingDb();
  const { error } = await db.from("marketing_sequences").delete().eq("id", sequenceId);
  if (error) throw error;
}

/** Send every step of a sequence to a single test address so the sender can preview the
 *  real emails. Ignores conditions/delays (all steps go at once), subject-prefixed [TEST].
 *  Touches no contacts or enrollment state. */
export async function sendSequenceTest(
  sequenceId: string,
  testEmail: string,
): Promise<{ sent: number; failed: number; steps: number; error?: string }> {
  const db = await marketingDb();
  const { data: seq } = await db
    .from("marketing_sequences")
    .select("id, name, steps:marketing_sequence_steps(*, template:marketing_templates(*))")
    .eq("id", sequenceId)
    .maybeSingle();
  if (!seq) throw new Error("Sequence not found.");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const steps = ((seq.steps ?? []) as any[]).slice().sort((a, b) => a.step_order - b.step_order);
  if (steps.length === 0) return { sent: 0, failed: 0, steps: 0, error: "This sequence has no steps yet." };
  if (!emailConfigured()) return { sent: 0, failed: 0, steps: steps.length, error: "Email sending isn't configured (RESEND_API_KEY missing)." };

  const token = makeUnsubscribeToken(testEmail);
  let sent = 0, failed = 0;
  for (const step of steps) {
    if (!step.template) { failed++; continue; }
    const result = await sendMarketingEmail({
      to: testEmail, first_name: "Test", company: "iCFO",
      from_name: step.from_name, from_email: step.from_email,
      subject: `[TEST · step ${step.step_order}] ${step.template.subject}`,
      html_body: step.template.html_body, text_body: step.template.text_body,
      unsubscribe_token: token,
    });
    if (result.ok) sent++; else failed++;
    await new Promise((r) => setTimeout(r, 150));
  }
  return { sent, failed, steps: steps.length };
}

export async function enrollContact(
  sequenceId: string,
  contactId: string
): Promise<void> {
  const db = await marketingDb();

  const { data: firstStep } = await db
    .from("marketing_sequence_steps")
    .select("delay_days")
    .eq("sequence_id", sequenceId)
    .order("step_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  const delayMs = ((firstStep?.delay_days ?? 0) * 24 * 60 * 60 * 1000);
  const nextSendAt = new Date(Date.now() + delayMs).toISOString();

  await db
    .from("marketing_sequence_enrollments")
    .upsert(
      { sequence_id: sequenceId, contact_id: contactId, next_send_at: nextSendAt },
      { onConflict: "sequence_id,contact_id" }
    );
}

/** Bulk-enroll every contact in a list into a sequence (idempotent upsert). */
export async function enrollList(
  sequenceId: string,
  listId: string
): Promise<{ enrolled: number }> {
  const db = await marketingDb();

  const { data: firstStep } = await db
    .from("marketing_sequence_steps")
    .select("delay_days")
    .eq("sequence_id", sequenceId)
    .order("step_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  const delayMs = (firstStep?.delay_days ?? 0) * 24 * 60 * 60 * 1000;
  const nextSendAt = new Date(Date.now() + delayMs).toISOString();

  const { data: members } = await db
    .from("marketing_list_contacts")
    .select("contact_id")
    .eq("list_id", listId);

  const rows = (members ?? []).map((m: { contact_id: string }) => ({
    sequence_id: sequenceId,
    contact_id: m.contact_id,
    next_send_at: nextSendAt,
  }));

  if (rows.length === 0) return { enrolled: 0 };

  await db
    .from("marketing_sequence_enrollments")
    .upsert(rows, { onConflict: "sequence_id,contact_id" });

  return { enrolled: rows.length };
}

const CONDITION_EVENT: Record<string, string> = { no_open: "opened", no_click: "clicked", no_reply: "replied" };

/**
 * GATED: when steps come due, collect eligible contacts into PENDING BATCHES for
 * a human to review & release — no auto-send. Suppressed/condition-skipped
 * enrollments still advance automatically (nothing is sent for them).
 */
export async function collectDueSequenceBatches(): Promise<{ batches: number; queued: number }> {
  const db = await marketingDb();

  const { data: due } = await db
    .from("marketing_sequence_enrollments")
    .select(`*, contact:marketing_contacts(*)`)
    .eq("status", "active")
    .lte("next_send_at", new Date().toISOString())
    .limit(500);

  if (!due || due.length === 0) return { batches: 0, queued: 0 };

  // group due enrollments by sequence + current step
  const groups = new Map<string, typeof due>();
  for (const e of due) {
    const key = `${e.sequence_id}:${e.current_step}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(e);
  }

  let batches = 0, queued = 0;

  for (const group of groups.values()) {
    const first = group[0];
    const { data: step } = await db
      .from("marketing_sequence_steps")
      .select(`*, template:marketing_templates(*)`)
      .eq("sequence_id", first.sequence_id)
      .eq("step_order", first.current_step)
      .maybeSingle();

    if (!step) {
      await db.from("marketing_sequence_enrollments").update({ status: "completed" }).in("id", group.map((e) => e.id));
      continue;
    }

    const willSend: string[] = [];
    let suppressed = 0, skipped = 0;

    for (const e of group) {
      const contact = e.contact;
      if (!contact) { skipped++; continue; }
      if (await isUnsubscribed(contact.email)) {
        await db.from("marketing_sequence_enrollments").update({ status: "unsubscribed" }).eq("id", e.id);
        suppressed++; continue;
      }
      // condition (e.g. "only if not opened") — if the required absence is violated, skip + advance
      const req = step.condition !== "always" ? CONDITION_EVENT[step.condition] : null;
      if (req) {
        const { data: prior } = await db.from("marketing_events").select("id")
          .eq("contact_id", contact.id).eq("sequence_id", e.sequence_id).eq("event_type", req).maybeSingle();
        if (prior) { await advanceEnrollment(db, e, step); skipped++; continue; }
      }
      if (!step.template) { await advanceEnrollment(db, e, step); skipped++; continue; }
      willSend.push(e.id);
    }

    if (willSend.length === 0) continue;

    const { data: seq } = await db.from("marketing_sequences").select("approver_id").eq("id", first.sequence_id).maybeSingle();

    const { data: batch } = await db.from("marketing_sequence_batches").insert({
      sequence_id: first.sequence_id, step_id: step.id, step_order: first.current_step,
      eligible_count: group.length, will_send_count: willSend.length,
      suppressed_count: suppressed, skipped_count: skipped,
      approver_id: seq?.approver_id ?? null,
    }).select("id").single();

    if (batch) {
      await db.from("marketing_sequence_enrollments").update({ status: "awaiting_approval", batch_id: batch.id }).in("id", willSend);
      batches++; queued += willSend.length;
    }
  }

  return { batches, queued };
}

export interface PendingBatch {
  id: string;
  sequence_id: string;
  sequence_name: string;
  step_order: number;
  step_name: string | null;
  will_send_count: number;
  suppressed_count: number;
  skipped_count: number;
  created_at: string;
  approver_id: string | null;
  approver_name: string | null;
}

export async function getPendingBatches(): Promise<PendingBatch[]> {
  const db = await marketingDb();
  const { data } = await db
    .from("marketing_sequence_batches")
    .select(`id, sequence_id, step_order, will_send_count, suppressed_count, skipped_count, created_at, approver_id,
             sequence:marketing_sequences(name), step:marketing_sequence_steps(template:marketing_templates(name, subject)),
             approver:profiles!marketing_sequence_batches_approver_id_fkey(full_name, email)`)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((b) => ({
    id: b.id,
    sequence_id: b.sequence_id,
    sequence_name: b.sequence?.name ?? "Sequence",
    step_order: b.step_order,
    step_name: b.step?.template?.name ?? b.step?.template?.subject ?? null,
    will_send_count: b.will_send_count ?? 0,
    suppressed_count: b.suppressed_count ?? 0,
    skipped_count: b.skipped_count ?? 0,
    created_at: b.created_at,
    approver_id: b.approver_id ?? null,
    approver_name: b.approver?.full_name ?? b.approver?.email ?? null,
  }));
}

/** Human release: actually send the batch's queued emails, then advance enrollments. */
// Release (send) a pending batch. Processes at most `limit` recipients per call so a
// large batch (e.g. 500) never exceeds the serverless time budget — the caller loops
// until `remaining` reaches 0. The batch stays "pending" until fully drained.
export async function releaseSequenceBatch(batchId: string, releasedBy: string, limit = 50): Promise<{ sent: number; failed: number; remaining: number }> {
  const db = await marketingDb();
  const { data: batch } = await db.from("marketing_sequence_batches").select("*").eq("id", batchId).maybeSingle();
  if (!batch) throw new Error("Batch not found.");
  if (batch.status !== "pending") throw new Error("Batch already processed.");

  const { data: step } = await db.from("marketing_sequence_steps").select(`*, template:marketing_templates(*)`).eq("id", batch.step_id).maybeSingle();
  const { data: enrollments } = await db
    .from("marketing_sequence_enrollments")
    .select(`*, contact:marketing_contacts(*)`)
    .eq("batch_id", batchId)
    .eq("status", "awaiting_approval")
    .limit(limit);

  let sent = 0, failed = 0;
  for (const e of (enrollments ?? [])) {
    const contact = e.contact;
    if (!contact || !step?.template) { await advanceEnrollment(db, e, step ?? { step_order: e.current_step }); continue; }
    if (await isUnsubscribed(contact.email)) {
      await db.from("marketing_sequence_enrollments").update({ status: "unsubscribed", batch_id: null }).eq("id", e.id);
      continue;
    }
    const token = makeUnsubscribeToken(contact.email);
    const result = await sendMarketingEmail({
      to: contact.email, first_name: contact.first_name, company: contact.company,
      from_name: step.from_name, from_email: step.from_email,
      subject: step.template.subject, html_body: step.template.html_body, text_body: step.template.text_body,
      unsubscribe_token: token,
    });
    await db.from("marketing_events").insert({
      sequence_id: e.sequence_id, step_id: step.id, contact_id: contact.id, email: contact.email,
      resend_id: result.resend_id, event_type: result.ok ? "sent" : "failed",
      metadata: result.error ? { error: result.error } : {},
    });
    if (result.ok) sent++; else failed++;
    await advanceEnrollment(db, e, step);
    await new Promise((r) => setTimeout(r, 120));
  }

  // How many recipients are still awaiting approval on this batch after this chunk?
  const { count: remaining } = await db
    .from("marketing_sequence_enrollments")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batchId)
    .eq("status", "awaiting_approval");
  const left = remaining ?? 0;

  // Only mark the batch released once every recipient has been processed.
  if (left === 0) {
    await db.from("marketing_sequence_batches").update({ status: "released", released_by: releasedBy, released_at: new Date().toISOString() }).eq("id", batchId);
  }
  return { sent, failed, remaining: left };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function advanceEnrollment(db: any, enrollment: { id: string; sequence_id: string; current_step: number }, currentStep: { step_order: number }): Promise<void> {
  const nextStepOrder = currentStep.step_order + 1;

  const { data: nextStep } = await db
    .from("marketing_sequence_steps")
    .select("delay_days, step_order")
    .eq("sequence_id", enrollment.sequence_id)
    .eq("step_order", nextStepOrder)
    .maybeSingle();

  if (!nextStep) {
    await db
      .from("marketing_sequence_enrollments")
      .update({ status: "completed", batch_id: null })
      .eq("id", enrollment.id);
    return;
  }

  const delayMs = nextStep.delay_days * 24 * 60 * 60 * 1000;
  const nextSendAt = new Date(Date.now() + delayMs).toISOString();

  await db
    .from("marketing_sequence_enrollments")
    .update({ current_step: nextStepOrder, next_send_at: nextSendAt, status: "active", batch_id: null })
    .eq("id", enrollment.id);
}
