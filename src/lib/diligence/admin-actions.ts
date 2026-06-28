// Admin lifecycle actions: send-to-founder, mark-review, recall. Service role.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { evaluateTransition, priorStage } from "./state-machine";
import { applyDefaultGate } from "./gate";
import { ddAudit } from "./audit";
import { sendFounderReady } from "./email";
import type { Stage } from "./types";

function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

export class ActionError extends Error {
  constructor(message: string) { super(message); this.name = "ActionError"; }
}

async function stageOf(supabase: SupabaseClient<Database>, eid: string): Promise<Stage> {
  const { data } = await raw(supabase).from("dd_engagements").select("lifecycle_stage").eq("id", eid).maybeSingle();
  const s = (data as { lifecycle_stage?: Stage } | null)?.lifecycle_stage;
  if (!s) throw new ActionError("Engagement not found.");
  return s;
}

/** Add the founder as a member, apply the default gate, transition, notify.
 *  If no email is given, resolves the founder from the engagement's linked company. */
export async function sendToFounder(
  supabase: SupabaseClient<Database>,
  eid: string,
  actorId: string,
  founderEmail?: string | null,
): Promise<{ delivered: boolean }> {
  const current = await stageOf(supabase, eid);
  const t = evaluateTransition(current, "send_to_founder", "admin");
  if (!t.ok) throw new ActionError(t.error);

  let founder: { id: string; email: string; role: string } | null = null;

  if (founderEmail && founderEmail.trim()) {
    const { data: prof } = await raw(supabase).from("profiles").select("id, email, role").ilike("email", founderEmail.trim()).maybeSingle();
    founder = prof as { id: string; email: string; role: string } | null;
  } else {
    // Resolve from the linked company's founder.
    const { data: eng } = await raw(supabase).from("dd_engagements").select("company_id").eq("id", eid).maybeSingle();
    const companyId = (eng as { company_id?: string } | null)?.company_id;
    if (companyId) {
      const { data: comp } = await raw(supabase).from("companies").select("founder_id").eq("id", companyId).maybeSingle();
      const founderId = (comp as { founder_id?: string } | null)?.founder_id;
      if (founderId) {
        const { data: prof } = await raw(supabase).from("profiles").select("id, email, role").eq("id", founderId).maybeSingle();
        founder = prof as { id: string; email: string; role: string } | null;
      }
    }
    if (!founder) throw new ActionError("No founder is linked to this engagement. Enter the founder's email to send.");
  }

  if (!founder) throw new ActionError("No account found for that email. The founder must have a iCapOS account first.");
  if (String(founder.role).toLowerCase() !== "founder") throw new ActionError("That account is not a founder.");

  await raw(supabase).from("dd_engagement_members").upsert(
    { engagement_id: eid, user_id: founder.id, role: "founder" },
    { onConflict: "engagement_id,user_id" },
  );

  await applyDefaultGate(supabase, eid);
  await raw(supabase).from("dd_engagements").update({ lifecycle_stage: t.to, updated_at: new Date().toISOString() }).eq("id", eid);
  await ddAudit(supabase, { engagementId: eid, actorId, action: "stage.send_to_founder", target: eid, before: { from: current }, after: { to: t.to, founder: founder.email } });

  const { data: eng } = await raw(supabase).from("dd_engagements").select("company_name").eq("id", eid).maybeSingle();
  let delivered = false;
  try {
    const r = await sendFounderReady(founder.email, (eng as { company_name?: string } | null)?.company_name ?? "your company", eid);
    delivered = r.delivered;
  } catch {
    // membership + gate applied; email is best-effort.
  }
  return { delivered };
}

export async function markReviewReady(supabase: SupabaseClient<Database>, eid: string, actorId: string): Promise<void> {
  const current = await stageOf(supabase, eid);
  const t = evaluateTransition(current, "mark_review", "admin");
  if (!t.ok) throw new ActionError(t.error);
  await raw(supabase).from("dd_engagements").update({ lifecycle_stage: t.to, updated_at: new Date().toISOString() }).eq("id", eid);
  await ddAudit(supabase, { engagementId: eid, actorId, action: "stage.mark_review", target: eid, before: { from: current }, after: { to: t.to } });
}

/** Move one stage back and reopen (admin), pre-lock only. */
export async function recall(supabase: SupabaseClient<Database>, eid: string, actorId: string): Promise<void> {
  const current = await stageOf(supabase, eid);
  if (current === "consented_locked" || current === "released") {
    throw new ActionError("A locked or released engagement can't be recalled.");
  }
  const prior = priorStage(current);
  if (!prior) throw new ActionError("Already at the first stage.");
  await raw(supabase).from("dd_engagements").update({ lifecycle_stage: prior, updated_at: new Date().toISOString() }).eq("id", eid);
  await ddAudit(supabase, { engagementId: eid, actorId, action: "stage.recall", target: eid, before: { from: current }, after: { to: prior } });
}
