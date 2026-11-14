// Hybrid CRM automation engine. Events (meeting booked, proposal sent, signup link
// emailed, account created, payment) come in from the existing flows, are matched
// against the editable rules, and either create an opportunity, move it, or ask
// the person first. Everything here is best effort: it must never break the
// booking, send, signup or payment that called it.
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/notifications";
import { staffRecipients } from "@/lib/notifications/new-customer-alerts";
import { logActivity } from "@/lib/sales/activity";
import { createOpportunity, updateOpportunity } from "@/lib/sales/opportunities";
import { fromAllows, reasonText, ruleMatches, type TriggerKey } from "@/lib/sales/automation-core";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export type AutomationRule = {
  id: string; stage_id: string; name: string; action: "create" | "move"; triggers: string[];
  match_mode: "any" | "all"; mode: "ask" | "auto"; wait_days: number; from_stage_ids: string[];
  enabled: boolean; sort_order: number;
};

export type AutomationApproval = {
  id: string; opportunity_id: string; rule_id: string | null; from_stage_id: string | null; to_stage_id: string;
  trigger: string; reason: string; status: "pending" | "approved" | "kept" | "cancelled"; created_at: string;
  to_stage_name?: string | null; from_stage_name?: string | null;
};

const RULE_COLS = "id, stage_id, name, action, triggers, match_mode, mode, wait_days, from_stage_ids, enabled, sort_order";

export async function listRules(): Promise<AutomationRule[]> {
  const { data } = await db().from("sales_automation_rules").select(RULE_COLS).order("sort_order").order("created_at");
  return (data ?? []) as AutomationRule[];
}

async function findContact(email: string, contactCrmId?: string | null): Promise<{ id: string; name: string; company: string | null; assignee: string | null } | null> {
  let q = db().from("crm_contacts").select("id, name, company, assignee_ids");
  q = contactCrmId ? q.eq("id", contactCrmId) : q.ilike("email", email);
  const { data } = await q.limit(1).maybeSingle();
  if (!data) return null;
  const ids = Array.isArray(data.assignee_ids) ? (data.assignee_ids as string[]) : [];
  return { id: String(data.id), name: String(data.name ?? email), company: (data.company as string | null) ?? null, assignee: ids[0] ?? null };
}

/** The contact's current open opportunity, newest first. */
async function openOpportunity(contactId: string, email: string) {
  const sel = "id, title, stage_id, status, owner_id, contact_name";
  const { data } = await db().from("sales_opportunities").select(sel).eq("contact_crm_id", contactId).eq("status", "open").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (data) return data as { id: string; title: string; stage_id: string | null; status: string; owner_id: string | null; contact_name: string | null };
  const { data: byEmail } = await db().from("sales_opportunities").select(sel).ilike("contact_email", email).eq("status", "open").order("created_at", { ascending: false }).limit(1).maybeSingle();
  return (byEmail as { id: string; title: string; stage_id: string | null; status: string; owner_id: string | null; contact_name: string | null } | null) ?? null;
}

async function stageInfo(id: string): Promise<{ id: string; name: string; is_won: boolean; sequence_id: string | null } | null> {
  const { data } = await db().from("sales_stages").select("id, name, is_won, sequence_id").eq("id", id).maybeSingle();
  return (data as { id: string; name: string; is_won: boolean; sequence_id: string | null } | null) ?? null;
}

/** Moves the opportunity. Won sets the Won stage first, then the status, so the stage log and sequence enrollment still run. */
export async function applyStageMove(opportunityId: string, stageId: string, actorId: string | null): Promise<void> {
  const st = await stageInfo(stageId);
  await updateOpportunity(opportunityId, { stageId }, actorId);
  if (st?.is_won) await updateOpportunity(opportunityId, { status: "won" }, actorId);
}

/** Records the event. Returns false for a repeat of the same event inside ten minutes (webhook retries). */
async function recordEvent(contactId: string, email: string, trigger: TriggerKey): Promise<boolean> {
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: dupe } = await db().from("sales_automation_events").select("id").eq("contact_crm_id", contactId).eq("trigger", trigger).gte("created_at", since).limit(1).maybeSingle();
  if (dupe) return false;
  await db().from("sales_automation_events").insert({ contact_crm_id: contactId, email: email.toLowerCase(), trigger });
  return true;
}

async function seenTriggers(contactId: string): Promise<Set<string>> {
  const { data } = await db().from("sales_automation_events").select("trigger").eq("contact_crm_id", contactId);
  return new Set(((data ?? []) as Array<{ trigger: string }>).map((r) => r.trigger));
}

async function notifyOwner(opp: { id: string; title: string; owner_id: string | null }, approvalId: string, toName: string, reason: string, actorId: string | null) {
  const recipients = opp.owner_id ? [{ id: opp.owner_id }] : await staffRecipients();
  await Promise.all(recipients.map((p) => createNotification({
    recipientUserId: p.id,
    actorUserId: actorId,
    type: "sales_automation_suggestion",
    title: `Move ${opp.title} to ${toName}?`,
    message: `Because ${reason}. Open the opportunity to approve or keep it where it is.`,
    entityType: "opportunity",
    entityId: opp.id,
    deepLink: `/admin/sales/opportunities/${opp.id}`,
    dedupeKey: `crm_auto:${approvalId}`,
  })));
}

/**
 * Entry point. Call from the booking, proposal, email, signup and payment flows.
 * Never throws.
 */
export async function fireCrmAutomation(
  trigger: TriggerKey,
  input: { email?: string | null; contactCrmId?: string | null; actorId?: string | null; /** Timer events only: days since signup, so each rule honors its own wait. */ ageDays?: number },
): Promise<void> {
  try {
    const email = (input.email ?? "").trim().toLowerCase();
    if (!email && !input.contactCrmId) return;
    const contact = await findContact(email, input.contactCrmId);
    if (!contact) {
      // No CRM contact. An opportunity may still carry this email.
      if (!email) return;
      const opp = await db().from("sales_opportunities").select("contact_crm_id").ilike("contact_email", email).not("contact_crm_id", "is", null).limit(1).maybeSingle();
      const cid = (opp.data?.contact_crm_id as string | undefined) ?? null;
      if (!cid) return;
      return fireCrmAutomation(trigger, { ...input, contactCrmId: cid });
    }
    if (!(await recordEvent(contact.id, email || "", trigger))) return;

    const rules = (await listRules()).filter((r) => r.enabled && r.triggers.includes(trigger) && (input.ageDays == null || r.wait_days <= input.ageDays));
    if (rules.length === 0) return;
    const seen = await seenTriggers(contact.id);
    const actorId = input.actorId ?? null;

    // Create rules first, so a move rule can act on the opportunity that was just made.
    const ordered = [...rules.filter((r) => r.action === "create"), ...rules.filter((r) => r.action === "move")];
    for (const rule of ordered) {
      if (!ruleMatches({ triggers: rule.triggers, match_mode: rule.match_mode, from_stage_ids: rule.from_stage_ids }, trigger, seen)) continue;
      const reason = reasonText(rule, trigger);
      let opp = await openOpportunity(contact.id, email);

      if (rule.action === "create") {
        if (opp) continue; // one open opportunity per contact
        const created = await createOpportunity({
          name: contact.name, email: email || null, company: contact.company, contactCrmId: contact.id,
          stageId: rule.stage_id, source: "Automation", ownerId: contact.assignee ?? actorId, createdBy: actorId,
        });
        if (created) {
          await logActivity({ kind: "opp_note", summary: `Opportunity created automatically because ${reason}`, actorId, opportunityId: created.id, meta: { automation: true, rule_id: rule.id, trigger } });
        }
        continue;
      }

      opp = opp ?? null;
      if (!opp || opp.stage_id === rule.stage_id || !fromAllows(rule, opp.stage_id)) continue;
      if (input.ageDays != null) {
        // Timer rules look at the same contact every day: suggest once per rule, whatever the answer was.
        const { data: asked } = await db().from("sales_automation_approvals").select("id").eq("opportunity_id", opp.id).eq("rule_id", rule.id).limit(1).maybeSingle();
        if (asked) continue;
      }
      const target = await stageInfo(rule.stage_id);
      if (!target) continue;
      // Entering a stage with a sequence emails the contact, so a person always confirms that move.
      const mustAsk = rule.mode === "ask" || !!target.sequence_id;
      if (!mustAsk) {
        await applyStageMove(opp.id, rule.stage_id, actorId);
        await logActivity({ kind: "stage_changed", summary: `Moved to ${target.name} automatically because ${reason}`, actorId, opportunityId: opp.id, meta: { automation: true, rule_id: rule.id, trigger } });
        continue;
      }
      const { data: ins, error } = await db().from("sales_automation_approvals").insert({
        opportunity_id: opp.id, rule_id: rule.id, from_stage_id: opp.stage_id, to_stage_id: rule.stage_id, trigger, reason,
      }).select("id").single();
      if (error || !ins) continue; // an open suggestion for this stage already exists
      await logActivity({ kind: "opp_note", summary: `Suggested moving to ${target.name} because ${reason}`, actorId, opportunityId: opp.id, meta: { automation: true, approval_id: ins.id } });
      await notifyOwner(opp, String(ins.id), target.name, reason, actorId);
    }
  } catch (err) {
    console.warn(`[crm-automation] ${trigger} failed`, err);
  }
}

export async function listPendingApprovals(opportunityId?: string): Promise<AutomationApproval[]> {
  let q = db().from("sales_automation_approvals")
    .select("id, opportunity_id, rule_id, from_stage_id, to_stage_id, trigger, reason, status, created_at, to:sales_stages!sales_automation_approvals_to_stage_id_fkey(name), from:sales_stages!sales_automation_approvals_from_stage_id_fkey(name)")
    .eq("status", "pending").order("created_at", { ascending: false }).limit(200);
  if (opportunityId) q = q.eq("opportunity_id", opportunityId);
  const { data } = await q;
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id), opportunity_id: String(r.opportunity_id), rule_id: (r.rule_id as string) ?? null,
    from_stage_id: (r.from_stage_id as string) ?? null, to_stage_id: String(r.to_stage_id), trigger: String(r.trigger),
    reason: String(r.reason), status: r.status as AutomationApproval["status"], created_at: String(r.created_at),
    to_stage_name: (r.to as { name?: string } | null)?.name ?? null, from_stage_name: (r.from as { name?: string } | null)?.name ?? null,
  }));
}

/** Approve (move) or keep (stay put). A decision on a suggestion someone already answered is a no-op. */
export async function decideApproval(id: string, decision: "approve" | "keep", actorId: string): Promise<{ ok: boolean; error?: string }> {
  const { data: a } = await db().from("sales_automation_approvals").select("id, opportunity_id, to_stage_id, reason, status").eq("id", id).maybeSingle();
  if (!a) return { ok: false, error: "Suggestion not found." };
  if (a.status !== "pending") return { ok: false, error: "This suggestion was already answered or cancelled." };
  const stamp = { decided_at: new Date().toISOString(), decided_by: actorId };
  if (decision === "keep") {
    await db().from("sales_automation_approvals").update({ status: "kept", ...stamp }).eq("id", id);
    await logActivity({ kind: "opp_note", summary: "Kept in the current stage (suggestion declined)", actorId, opportunityId: a.opportunity_id as string });
    return { ok: true };
  }
  const st = await stageInfo(a.to_stage_id as string);
  await applyStageMove(a.opportunity_id as string, a.to_stage_id as string, actorId);
  await db().from("sales_automation_approvals").update({ status: "approved", ...stamp }).eq("id", id);
  await logActivity({ kind: "stage_changed", summary: `Moved to ${st?.name ?? "the suggested stage"} (approved suggestion: ${a.reason})`, actorId, opportunityId: a.opportunity_id as string });
  return { ok: true };
}

/** A manual stage change answers any open suggestion for that opportunity. */
export async function cancelPendingApprovals(opportunityId: string, actorId: string | null): Promise<void> {
  try {
    const { data } = await db().from("sales_automation_approvals").update({ status: "cancelled", decided_at: new Date().toISOString(), decided_by: actorId }).eq("opportunity_id", opportunityId).eq("status", "pending").select("id");
    if (data && data.length > 0) await logActivity({ kind: "opp_note", summary: "Suggestion cancelled because the stage was changed by hand", actorId, opportunityId });
  } catch { /* never block a stage change */ }
}

async function hasPaid(email: string): Promise<boolean> {
  const { data: ps } = await db().from("paid_signups").select("id").ilike("paid_email", email).in("status", ["paid", "claimed"]).limit(1).maybeSingle();
  if (ps) return true;
  const { data: prof } = await db().from("profiles").select("id").ilike("email", email).maybeSingle();
  if (!prof) return false;
  const { data: sub } = await db().from("subscriptions").select("subscription_status").eq("profile_id", prof.id).maybeSingle();
  return sub?.subscription_status === "active";
}

/** Daily pass: contacts who signed up, waited the rule's days and have not paid. */
export async function runAutomationTimers(): Promise<{ fired: number }> {
  let fired = 0;
  try {
    const rules = (await listRules()).filter((r) => r.enabled && r.triggers.includes("signed_up_unpaid"));
    if (rules.length === 0) return { fired };
    const wait = Math.min(...rules.map((r) => r.wait_days));
    const cutoff = new Date(Date.now() - wait * 86400_000).toISOString();
    const { data } = await db().from("sales_automation_events").select("contact_crm_id, email, created_at").eq("trigger", "signed_up").lte("created_at", cutoff).order("created_at", { ascending: false }).limit(500);
    const done = new Set<string>();
    for (const row of (data ?? []) as Array<{ contact_crm_id: string; email: string | null; created_at: string }>) {
      if (done.has(row.contact_crm_id)) continue;
      done.add(row.contact_crm_id);
      const seen = await seenTriggers(row.contact_crm_id);
      if (seen.has("payment_received")) continue;
      if (row.email && (await hasPaid(row.email))) continue;
      const ageDays = Math.floor((Date.now() - new Date(row.created_at).getTime()) / 86400_000);
      await fireCrmAutomation("signed_up_unpaid", { email: row.email, contactCrmId: row.contact_crm_id, ageDays });
      fired += 1;
    }
  } catch (err) {
    console.warn("[crm-automation] timers failed", err);
  }
  return { fired };
}
