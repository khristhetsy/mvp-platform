"use server";

import { marketingDb } from "./db";
import { makeUnsubscribeToken, sendMarketingEmail } from "./send";
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

export async function createSequence(name: string): Promise<MarketingSequence> {
  const db = await marketingDb();
  const { data: { user } } = await db.auth.getUser();
  const { data, error } = await db
    .from("marketing_sequences")
    .insert({ name, created_by: user?.id })
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

export async function processDueSequenceSteps(): Promise<{ processed: number }> {
  const db = await marketingDb();

  const { data: due } = await db
    .from("marketing_sequence_enrollments")
    .select(`
      *,
      contact:marketing_contacts(*),
      sequence:marketing_sequences(*)
    `)
    .eq("status", "active")
    .lte("next_send_at", new Date().toISOString())
    .limit(100);

  if (!due || due.length === 0) return { processed: 0 };

  let processed = 0;

  for (const enrollment of due) {
    const contact = enrollment.contact;
    if (!contact) continue;

    const unsub = await isUnsubscribed(contact.email);
    if (unsub) {
      await db
        .from("marketing_sequence_enrollments")
        .update({ status: "unsubscribed" })
        .eq("id", enrollment.id);
      continue;
    }

    const { data: step } = await db
      .from("marketing_sequence_steps")
      .select(`*, template:marketing_templates(*)`)
      .eq("sequence_id", enrollment.sequence_id)
      .eq("step_order", enrollment.current_step)
      .maybeSingle();

    if (!step) {
      await db
        .from("marketing_sequence_enrollments")
        .update({ status: "completed" })
        .eq("id", enrollment.id);
      continue;
    }

    if (step.condition !== "always") {
      const eventMap: Record<string, string> = {
        no_open: "opened",
        no_click: "clicked",
        no_reply: "replied",
      };
      const requiredAbsence = eventMap[step.condition];
      if (requiredAbsence) {
        const { data: priorEvent } = await db
          .from("marketing_events")
          .select("id")
          .eq("contact_id", contact.id)
          .eq("sequence_id", enrollment.sequence_id)
          .eq("event_type", requiredAbsence)
          .maybeSingle();

        if (priorEvent) {
          await advanceEnrollment(db, enrollment, step);
          continue;
        }
      }
    }

    const template = step.template;
    if (!template) {
      await advanceEnrollment(db, enrollment, step);
      continue;
    }

    const token = makeUnsubscribeToken(contact.email);
    const result = await sendMarketingEmail({
      to: contact.email,
      first_name: contact.first_name,
      company: contact.company,
      from_name: step.from_name,
      from_email: step.from_email,
      subject: template.subject,
      html_body: template.html_body,
      text_body: template.text_body,
      unsubscribe_token: token,
    });

    await db.from("marketing_events").insert({
      sequence_id: enrollment.sequence_id,
      step_id: step.id,
      contact_id: contact.id,
      email: contact.email,
      resend_id: result.resend_id,
      event_type: result.ok ? "sent" : "failed",
      metadata: result.error ? { error: result.error } : {},
    });

    await advanceEnrollment(db, enrollment, step);
    processed++;

    await new Promise((r) => setTimeout(r, 200));
  }

  return { processed };
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
      .update({ status: "completed" })
      .eq("id", enrollment.id);
    return;
  }

  const delayMs = nextStep.delay_days * 24 * 60 * 60 * 1000;
  const nextSendAt = new Date(Date.now() + delayMs).toISOString();

  await db
    .from("marketing_sequence_enrollments")
    .update({ current_step: nextStepOrder, next_send_at: nextSendAt })
    .eq("id", enrollment.id);
}
