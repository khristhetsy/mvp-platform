// Multichannel cadence engine. Enrolls a campaign's audience, and a cron tick
// fires each contact's due step (voice / sms / whatsapp / email) then advances
// them. Every step still passes its channel gate — cadence only decides WHEN.
// Service-role only; behind the master kill-switch (via the per-channel gates).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { CadenceStep } from "@/lib/voice/types";
import { dialRestriction } from "@/lib/voice/audience";
import { preDialGate } from "@/lib/voice/gate";
import { placeVapiCall } from "@/lib/voice/vapi";
import { pickVariant } from "@/lib/voice/campaigns";
import { messageGate, sendMessage } from "@/lib/voice/messaging";

function raw(c: SupabaseClient<Database>): SupabaseClient {
  return c as unknown as SupabaseClient;
}

export type StepOutcome = "sent" | "retry" | "skip" | "stop";
type EnrollmentRow = { id: string; campaign_id: string; contact_id: string; current_step: number; retry_count: number };

/** Give up on a step after this many failed retries and advance the contact. */
const MAX_RETRIES = 3;

/**
 * Pure advancement: given the outcome of the current step, compute the next
 * enrollment state. Extracted so the state machine is unit-tested.
 */
export function advance(
  currentStep: number,
  steps: CadenceStep[],
  outcome: StepOutcome,
  now: number = Date.now(),
): { status: "active" | "completed" | "stopped"; currentStep: number; nextRunAt: string } {
  if (outcome === "stop") return { status: "stopped", currentStep, nextRunAt: new Date(now).toISOString() };
  if (outcome === "retry") return { status: "active", currentStep, nextRunAt: new Date(now + 60 * 60 * 1000).toISOString() }; // +1h
  const next = currentStep + 1;
  if (next >= steps.length) return { status: "completed", currentStep, nextRunAt: new Date(now).toISOString() };
  const delayH = Math.max(0, steps[next].delayHours ?? 0);
  return { status: "active", currentStep: next, nextRunAt: new Date(now + delayH * 60 * 60 * 1000).toISOString() };
}

/** Gate reasons that mean "give up on this contact" vs "try again later". */
function outcomeFromGate(reason: string | undefined): StepOutcome {
  const r = reason ?? "";
  if (r === "dnc" || r === "no_consent" || r === "jurisdiction_blocked" || r === "attempt_cap" || r === "system_disabled") return "stop";
  if (r === "outside_hours") return "retry"; // resolves once the local window opens
  return "skip"; // no_phone, no_timezone (never self-resolves), etc. — move on
}

/** Execute one cadence step for a contact. Returns how to advance. */
async function executeStep(contactId: string, campaignId: string, step: CadenceStep): Promise<StepOutcome> {
  if (step.channel === "email") {
    // Email steps are owned by the Marketing Hub; log a touch and move on.
    const supabase = raw(createServiceRoleClient());
    await supabase.from("outreach_touches").insert({ contact_id: contactId, channel: "email", direction: "outbound", campaign_id: campaignId, summary: "Cadence email step (Marketing Hub)" }).then(() => undefined, () => undefined);
    return "skip";
  }

  if (step.channel === "voice") {
    const gate = await preDialGate(contactId);
    if (!gate.eligible || !gate.phone) return outcomeFromGate(gate.reason);
    const variant = await pickVariant(campaignId);
    try {
      await placeVapiCall(gate.phone, {
        metadata: { contactId, campaignId, variantId: variant?.id ?? null },
        opener: variant?.openerScript ?? null,
      });
      return "sent";
    } catch {
      return "retry";
    }
  }

  // sms | whatsapp
  const gate = await messageGate(contactId, step.channel);
  if (!gate.eligible) return outcomeFromGate(gate.reason);
  const body = step.body?.trim() || "Following up from iCFO Capital. Reply STOP to opt out.";
  const res = await sendMessage(contactId, step.channel, body, { campaignId });
  return res.ok ? "sent" : outcomeFromGate(res.reason);
}

/** Enroll a campaign's audience into its cadence (idempotent). Requires steps. */
export async function enrollCampaignCadence(campaignId: string): Promise<{ enrolled: number }> {
  const supabase = raw(createServiceRoleClient());
  const { data: camp } = await supabase.from("voice_campaigns").select("audience_config, cadence_steps").eq("id", campaignId).maybeSingle();
  const c = camp as { audience_config?: unknown; cadence_steps?: CadenceStep[] | null } | null;
  const steps = (c?.cadence_steps ?? []) as CadenceStep[];
  if (steps.length === 0) throw new Error("Add at least one cadence step before enrolling.");

  // Scope: the campaign's audience snapshot, else the currently-eligible pool.
  let ids = dialRestriction((c?.audience_config as Parameters<typeof dialRestriction>[0]) ?? null);
  if (!ids) {
    const { data } = await supabase.from("v_call_queue").select("contact_id").limit(5000);
    ids = ((data ?? []) as { contact_id: string }[]).map((r) => r.contact_id);
  }
  if (ids.length === 0) return { enrolled: 0 };

  const nextRun = new Date(Date.now() + Math.max(0, steps[0].delayHours ?? 0) * 60 * 60 * 1000).toISOString();
  const rows = ids.map((cid) => ({ campaign_id: campaignId, contact_id: cid, current_step: 0, status: "active", next_run_at: nextRun }));
  for (let i = 0; i < rows.length; i += 500) {
    await supabase.from("voice_cadence_enrollments").upsert(rows.slice(i, i + 500), { onConflict: "campaign_id,contact_id", ignoreDuplicates: true });
  }
  return { enrolled: ids.length };
}

/** Fire all due cadence steps (called by cron). */
export async function runCadenceTick(limit = 100): Promise<{ processed: number; sent: number; completed: number; stopped: number }> {
  const supabase = raw(createServiceRoleClient());
  const nowIso = new Date().toISOString();
  const { data: due } = await supabase
    .from("voice_cadence_enrollments")
    .select("id, campaign_id, contact_id, current_step, retry_count")
    .eq("status", "active")
    .lte("next_run_at", nowIso)
    .order("next_run_at", { ascending: true })
    .limit(limit);

  const rows = (due ?? []) as EnrollmentRow[];
  const stepsByCampaign = new Map<string, CadenceStep[]>();
  const loadSteps = async (campaignId: string): Promise<CadenceStep[]> => {
    if (stepsByCampaign.has(campaignId)) return stepsByCampaign.get(campaignId)!;
    const { data } = await supabase.from("voice_campaigns").select("cadence_steps, status").eq("id", campaignId).maybeSingle();
    const row = data as { cadence_steps?: CadenceStep[] | null; status?: string } | null;
    const steps = row?.status === "active" ? (row?.cadence_steps ?? []) : []; // paused/archived → no steps → complete out
    stepsByCampaign.set(campaignId, steps);
    return steps;
  };

  let sent = 0, completed = 0, stopped = 0;
  for (const enr of rows) {
    const steps = await loadSteps(enr.campaign_id);
    let outcome: StepOutcome;
    if (steps.length === 0 || enr.current_step >= steps.length) {
      outcome = "skip"; // nothing to do → advance() will complete it
    } else {
      try {
        outcome = await executeStep(enr.contact_id, enr.campaign_id, steps[enr.current_step]);
      } catch {
        outcome = "retry";
      }
    }
    // Bound retries: after MAX_RETRIES on the same step, give up and advance
    // instead of rescheduling +1h forever. Any non-retry outcome resets the count.
    const priorRetries = enr.retry_count ?? 0;
    let retryCount = 0;
    if (outcome === "retry") {
      if (priorRetries + 1 >= MAX_RETRIES) outcome = "skip"; // exhausted → move on
      else retryCount = priorRetries + 1;
    }
    const next = advance(enr.current_step, steps.length ? steps : [{ channel: "voice", delayHours: 0 }], outcome);
    if (outcome === "sent") sent += 1;
    if (next.status === "completed") completed += 1;
    if (next.status === "stopped") stopped += 1;
    await supabase.from("voice_cadence_enrollments").update({
      status: next.status,
      current_step: next.currentStep,
      next_run_at: next.nextRunAt,
      retry_count: retryCount,
      updated_at: nowIso,
    }).eq("id", enr.id);
  }
  return { processed: rows.length, sent, completed, stopped };
}
