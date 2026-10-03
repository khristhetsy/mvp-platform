/**
 * The record of a founder's introduction request, written in three places:
 *
 *   1. Account activity (operational_activity_events), through recordActivity,
 *      which also alerts the Marketing stage owners in app.
 *   2. The investor's contact timeline (sales_activity_log, the Note Log on the
 *      contact profile), when the investor maps to a CRM contact.
 *   3. The founder's own notifications, for the request itself. Decisions on the
 *      request already notify the founder from the admin routes.
 *
 * Never throws: a log line must not fail the request or the staff action it
 * describes.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { recordActivity } from "@/lib/activity/emit";
import { logActivity } from "@/lib/sales/activity";
import { createNotification } from "@/lib/notifications/notifications";
import { PROSPECT_ID_PREFIX } from "@/lib/matching/prospect-investors";
import {
  introHandledSummary,
  introHandledTitle,
  introRequestedSummary,
  type IntroHandledStatus,
  type IntroInvestorKind,
} from "@/lib/matching/intro-request-log-copy";

function db(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

export type IntroInvestor = {
  kind: IntroInvestorKind;
  name: string;
  /** crm_contacts.id, when the investor is a CRM contact. Keys the contact timeline. */
  contactCrmId: string | null;
  /** profiles.id of a registered investor. */
  profileId: string | null;
};

/** Who the request is for: a CRM prospect (`prospect:<id>`) or a registered investor (profile id). */
export async function resolveIntroInvestor(ref: string): Promise<IntroInvestor> {
  try {
    if (ref.startsWith(PROSPECT_ID_PREFIX)) {
      const id = ref.slice(PROSPECT_ID_PREFIX.length);
      const { data } = await db().from("prospect_investors").select("name, source, source_ref").eq("id", id).maybeSingle();
      const row = data as { name?: string | null; source?: string | null; source_ref?: string | null } | null;
      // Imported prospects carry the crm_contacts id as source_ref (source 'investor_crm').
      let contactCrmId: string | null = null;
      if (row?.source === "investor_crm" && row.source_ref) {
        const { data: c } = await db().from("crm_contacts").select("id").eq("id", row.source_ref).maybeSingle();
        contactCrmId = (c as { id?: string } | null)?.id ?? null;
      }
      return { kind: "prospect", name: row?.name?.trim() || "the investor", contactCrmId, profileId: null };
    }

    const { data: p } = await db().from("profiles").select("full_name, email").eq("id", ref).maybeSingle();
    const prof = p as { full_name?: string | null; email?: string | null } | null;
    let contactCrmId: string | null = null;
    const { data: linked } = await db().from("crm_contacts").select("id").eq("supabase_profile_id", ref).limit(1).maybeSingle();
    contactCrmId = (linked as { id?: string } | null)?.id ?? null;
    if (!contactCrmId && prof?.email) {
      const { data: byEmail } = await db().from("crm_contacts").select("id").ilike("email", prof.email.trim()).limit(1).maybeSingle();
      contactCrmId = (byEmail as { id?: string } | null)?.id ?? null;
    }
    return {
      kind: "member",
      name: prof?.full_name?.trim() || prof?.email || "the investor",
      contactCrmId,
      profileId: ref,
    };
  } catch {
    return { kind: ref.startsWith(PROSPECT_ID_PREFIX) ? "prospect" : "member", name: "the investor", contactCrmId: null, profileId: null };
  }
}

async function companyNameOf(companyId: string): Promise<string> {
  try {
    const { data } = await db().from("companies").select("company_name").eq("id", companyId).maybeSingle();
    return (data as { company_name?: string | null } | null)?.company_name?.trim() || "A founder";
  } catch {
    return "A founder";
  }
}

/** A founder just asked for an introduction. Call once per NEW request, not on a re-request. */
export async function logIntroRequested(input: {
  requestId: string | null;
  entityType: "intro_request" | "prospect_intro_request";
  companyId: string;
  founderId: string;
  investorRef: string;
}): Promise<void> {
  try {
    const investor = await resolveIntroInvestor(input.investorRef);
    const companyName = await companyNameOf(input.companyId);
    const entityId = input.requestId ?? `${input.companyId}:${input.investorRef}`;

    await recordActivity({
      classKey: "founder_intro_requested",
      actorUserId: input.founderId,
      actorRole: "founder",
      companyId: input.companyId,
      investorId: investor.profileId,
      entityType: input.entityType,
      entityId,
      title: `Requested an intro to ${investor.name}`,
      description: investor.kind === "prospect" ? "Prospect investor, brokered by iCFO" : "Registered investor, brokered by iCFO",
      sourceModule: "founder-matching-intro",
      metadata: { investor_ref: input.investorRef, investor_kind: investor.kind, investor_name: investor.name },
      dedupeKey: `founder-intro-requested:${entityId}`,
    });

    if (investor.contactCrmId) {
      await logActivity({
        kind: "intro",
        summary: introRequestedSummary(companyName),
        actorId: input.founderId,
        contactCrmId: investor.contactCrmId,
        meta: { company_id: input.companyId, entity_type: input.entityType, entity_id: entityId },
      });
    }

    await createNotification({
      recipientUserId: input.founderId,
      type: "founder_intro_requested",
      title: "Introduction requested",
      message: `iCFO is reviewing your request to meet ${investor.name}.`,
      entityType: input.entityType,
      entityId,
      deepLink: "/founder/matches",
      dedupeKey: `founder_intro_requested:${entityId}`,
    });
  } catch (error) {
    console.error("[capitalos] intro request log failed", {
      investorRef: input.investorRef,
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}

/** Staff moved a founder's introduction request. */
export async function logIntroHandled(input: {
  requestId: string;
  entityType: "intro_request" | "prospect_intro_request";
  status: IntroHandledStatus;
  companyId: string | null;
  investorRef: string | null;
  actorUserId: string;
  /** For a facilitated member intro: whether the investor was emailed. */
  investorEmailed?: boolean;
}): Promise<void> {
  try {
    const investor = input.investorRef ? await resolveIntroInvestor(input.investorRef) : null;
    const investorName = investor?.name ?? "the investor";
    const companyName = input.companyId ? await companyNameOf(input.companyId) : "A founder";

    await recordActivity({
      classKey: "founder_intro_handled",
      actorUserId: input.actorUserId,
      actorRole: "admin",
      companyId: input.companyId,
      investorId: investor?.profileId ?? null,
      entityType: input.entityType,
      entityId: input.requestId,
      title: introHandledTitle(input.status, investorName),
      description: input.investorEmailed ? "Investor emailed by iCFO" : null,
      sourceModule: "admin-intro-requests",
      metadata: { status: input.status, investor_ref: input.investorRef, investor_name: investorName },
      dedupeKey: `founder-intro-handled:${input.requestId}:${input.status}`,
    });

    if (investor?.contactCrmId) {
      await logActivity({
        kind: "intro",
        summary: introHandledSummary(input.status, companyName),
        actorId: input.actorUserId,
        contactCrmId: investor.contactCrmId,
        meta: { company_id: input.companyId, entity_type: input.entityType, entity_id: input.requestId, status: input.status },
      });
    }
  } catch (error) {
    console.error("[capitalos] intro handled log failed", {
      requestId: input.requestId,
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}
