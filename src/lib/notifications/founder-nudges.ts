// Proactive nudges for founders stalled in Preparation (qualify) — the stage
// where most companies die. Today the only cron nudge is scoped to onboarding
// and everything is in-app; this reaches a founder who finished onboarding but
// hasn't cleared Preparation, IN-APP AND BY EMAIL (the channel that reaches a
// founder who's stopped logging in). Deduped via hasRecentNotification so it
// fires at most once per window. Best-effort — never throws into the cron.

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createNotification, hasRecentNotification } from "@/lib/notifications/notifications";
import { sendEmail } from "@/lib/email/send-email";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildPreparationDocNudge, type UploadedDoc } from "@/lib/notifications/preparation-doc-nudge";
import { isInternalAccount } from "@/lib/notifications/internal-accounts";
import { NOT_A_BROKER_DEALER, renderEmail, type RenderedEmail } from "@/lib/email/layout";

const INACTIVE_DAYS = 5; // no company movement for this long
const DEDUPE_HOURS = 24 * 7; // at most one nudge a week

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://icapos.com").replace(/\/$/, "");

type ProfileRow = { id: string; email: string | null; full_name: string | null };
type CompanyRow = { founder_id: string | null; company_name: string | null; updated_at: string | null };

export async function nudgeStalledPreparationFounders(): Promise<{ nudged: number }> {
  let nudged = 0;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceRoleClient() as unknown as SupabaseClient<any>;

    // Founders in Preparation who haven't submitted (self-serve incomplete —
    // docs/score not yet met). Pending/approved founders have done their part.
    const { data: profs } = await db
      .from("profiles")
      .select("id, email, full_name")
      .eq("journey_stage", "qualify")
      .is("stage_approval_status", null)
      .limit(200);
    const founders = (profs ?? []) as ProfileRow[];
    if (founders.length === 0) return { nudged: 0 };

    const ids = founders.map((f) => f.id);
    const inactiveCutoff = new Date(Date.now() - INACTIVE_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: comps } = await db
      .from("companies")
      .select("founder_id, company_name, updated_at")
      .in("founder_id", ids);
    const companyByFounder = new Map<string, CompanyRow>();
    for (const c of (comps ?? []) as CompanyRow[]) {
      if (c.founder_id) companyByFounder.set(c.founder_id, c);
    }

    for (const f of founders) {
      const company = companyByFounder.get(f.id);
      // Only nudge founders whose company has genuinely gone quiet.
      if (!company || (company.updated_at && company.updated_at >= inactiveCutoff)) continue;

      const already = await hasRecentNotification({
        recipientUserId: f.id,
        type: "preparation_nudge",
        withinHours: DEDUPE_HOURS,
      });
      if (already) continue;

      await createNotification({
        recipientUserId: f.id,
        type: "preparation_nudge",
        title: "You're one step from investor matching",
        message: "Finish your Preparation checklist — your readiness score and documents — to get matched with investors.",
        entityType: "company",
        entityId: null,
      });

      if (f.email) {
        const mail = stageNudgeEmail(f.full_name?.split(" ")[0] ?? null, "qualify");
        if (mail) await sendEmail({ to: f.email, subject: mail.subject, html: mail.html, text: mail.text, fromName: "iCapOS" });
      }
      nudged += 1;
    }
  } catch {
    /* best-effort — telemetry/nudges must never break the cron */
  }
  return { nudged };
}

// Per-stage nudge copy for the generalized journey nudge. Onboarding is handled
// by the workflow-inactivity detector, so it's intentionally omitted here.
const STAGE_NUDGE: Record<string, { title: string; message: string; path: string; stage: string; lead: string }> = {
  qualify: {
    title: "You're one step from investor matching",
    message: "Finish your Preparation checklist — your documents and materials — to get matched with investors.",
    path: "/founder/stages/preparation",
    stage: "Preparation",
    lead: "You've done the hard part. Finish your Preparation checklist, your documents and the rest of your materials, and iCapOS will match you with investors from the iCFO network.",
  },
  deploy: {
    title: "Keep your investor outreach moving",
    message: "Your matches and outreach are ready in Marketing — pick them back up to keep momentum with investors.",
    path: "/founder/stages/marketing",
    stage: "Marketing",
    lead: "Your investor matches and outreach are live in Marketing. Jump back in to keep momentum with investors.",
  },
  optimize: {
    title: "Finish closing your round",
    message: "You're in the Closing stage — keep your deal room, updates, and milestones moving to close.",
    path: "/founder/stages/closing",
    stage: "Closing",
    lead: "You're in the Closing stage. Keep your deal room, investor updates, and milestones moving to close your round.",
  },
};

/** The stage nudge email for a founder whose company has gone quiet. Pure. */
export function stageNudgeEmail(firstName: string | null, stage: string): RenderedEmail | null {
  const copy = STAGE_NUDGE[stage];
  if (!copy) return null;
  return renderEmail({
    audience: "founder",
    subject: copy.title,
    preheader: copy.message,
    eyebrow: `Your raise · ${copy.stage}`,
    headline: copy.title,
    intro: `${firstName ? `Hi ${firstName}, ` : ""}${copy.lead}`,
    primary: { label: "Pick up where you left off", url: `${SITE_URL}${copy.path}` },
    footer: {
      reason: `You get this because your company has had no activity on iCapOS for ${INACTIVE_DAYS} days or more. At most one reminder a week.`,
      preferencesUrl: `${SITE_URL}/founder/settings`,
      lines: [`Every plan includes all tools. ${NOT_A_BROKER_DEALER}`],
    },
  });
}

/**
 * Generalizes the Preparation nudge to every stage a founder can stall in
 * (Preparation, Marketing, Closing). Skips founders whose approval is already
 * pending (they're waiting on staff, not themselves). In-app + email, deduped
 * weekly across all stages. Best-effort — never throws into the cron.
 */
/** One journey nudge the next run would send: the in-app note and, when the founder has an email, the email. */
export type JourneyNudgePlan = {
  founderId: string;
  founderName: string | null;
  email: string | null;
  companyName: string | null;
  stage: string;
  notification: { title: string; message: string; deepLink?: string };
  mail: { subject: string; html: string; text: string } | null;
};

/**
 * Who the journey nudge would contact right now, and with what, without sending
 * anything. The daily job sends exactly this list; Scheduled jobs shows it as the
 * Next run preview.
 */
export async function planJourneyNudges(): Promise<JourneyNudgePlan[]> {
  const plan: JourneyNudgePlan[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceRoleClient() as unknown as SupabaseClient<any>;

  const { data: profs } = await db
    .from("profiles")
    .select("id, email, full_name, role, journey_stage, stage_approval_status")
    .in("journey_stage", ["qualify", "deploy", "optimize"])
    .limit(400);
  const founders = (profs ?? []) as (ProfileRow & { role: string | null; journey_stage: string | null; stage_approval_status: string | null })[];
  // Skip founders awaiting staff approval (they've done their part) and staff or
  // test accounts (@myicfos.com, non-founder roles).
  const actionable = founders.filter(
    (f) => f.stage_approval_status !== "pending" && f.journey_stage && STAGE_NUDGE[f.journey_stage] && !isInternalAccount(f),
  );
  if (actionable.length === 0) return plan;

  const ids = actionable.map((f) => f.id);
  const inactiveCutoff = new Date(Date.now() - INACTIVE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: comps } = await db
    .from("companies")
    .select("founder_id, company_name, updated_at")
    .in("founder_id", ids);
  const companyByFounder = new Map<string, CompanyRow>();
  for (const c of (comps ?? []) as CompanyRow[]) {
    if (c.founder_id) companyByFounder.set(c.founder_id, c);
  }

  // Preparation founders get the document nudge: their own uploads, matched the
  // same way as the Preparation checklist (documents they uploaded).
  const prepIds = actionable.filter((f) => f.journey_stage === "qualify").map((f) => f.id);
  const uploadsByFounder = new Map<string, UploadedDoc[]>();
  if (prepIds.length) {
    const { data: docs } = await db
      .from("documents")
      .select("uploaded_by, document_type, created_at")
      .in("uploaded_by", prepIds);
    for (const d of (docs ?? []) as Array<UploadedDoc & { uploaded_by: string }>) {
      const list = uploadsByFounder.get(d.uploaded_by) ?? [];
      list.push({ document_type: d.document_type, created_at: d.created_at });
      uploadsByFounder.set(d.uploaded_by, list);
    }
  }

  for (const f of actionable) {
    const company = companyByFounder.get(f.id);
    if (!company || (company.updated_at && company.updated_at >= inactiveCutoff)) continue;

    const copy = STAGE_NUDGE[f.journey_stage as string];
    // Null when every required document is in; the general copy applies then.
    const docNudge =
      f.journey_stage === "qualify"
        ? buildPreparationDocNudge({
            firstName: f.full_name?.split(" ")[0] ?? null,
            companyName: company.company_name,
            uploads: uploadsByFounder.get(f.id) ?? [],
          })
        : null;
    const already = await hasRecentNotification({
      recipientUserId: f.id,
      type: "journey_nudge",
      withinHours: DEDUPE_HOURS,
    });
    if (already) continue;

    let mail: JourneyNudgePlan["mail"] = null;
    if (f.email && docNudge) {
      mail = { subject: docNudge.subject, html: docNudge.html, text: docNudge.text };
    } else if (f.email) {
      mail = stageNudgeEmail(f.full_name?.split(" ")[0] ?? null, f.journey_stage as string);
    }
    plan.push({
      founderId: f.id,
      founderName: f.full_name,
      email: f.email,
      companyName: company.company_name,
      stage: f.journey_stage as string,
      notification: {
        title: docNudge?.title ?? copy.title,
        message: docNudge?.message ?? copy.message,
        ...(docNudge ? { deepLink: copy.path } : {}),
      },
      mail,
    });
  }
  return plan;
}

export async function nudgeStalledJourneyFounders(): Promise<{ nudged: number }> {
  let nudged = 0;
  try {
    for (const p of await planJourneyNudges()) {
      await createNotification({
        recipientUserId: p.founderId,
        type: "journey_nudge",
        title: p.notification.title,
        message: p.notification.message,
        entityType: "company",
        entityId: null,
        ...(p.notification.deepLink ? { deepLink: p.notification.deepLink } : {}),
      });
      if (p.email && p.mail) {
        await sendEmail({ to: p.email, subject: p.mail.subject, html: p.mail.html, text: p.mail.text, fromName: "iCapOS" });
      }
      nudged += 1;
    }
  } catch {
    /* best-effort — telemetry/nudges must never break the cron */
  }
  return { nudged };
}
