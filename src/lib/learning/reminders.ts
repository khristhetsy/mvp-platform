import { sendTransactionalEmail } from "@/lib/email/transactional-send";
import { getAppUrl } from "@/lib/env";
import { getAICoachRecommendations } from "@/lib/learning/recommendations";
import {
  getLearningAdminSummaryForCompanies,
  listLearningProgressForCompany,
  listPublishedLearningModules,
} from "@/lib/learning/progress";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { LearningReminderRecord, LearningReminderType } from "@/lib/learning/types";

function appendLearningEmailFooter(body: string) {
  const appUrl = getAppUrl() ?? "http://localhost:3000";
  return `${body.trim()}\n\n---\nCapitalOS founder learning — educational content only, not legal, tax, or investment advice.\nContinue learning: ${appUrl}/founder/learning`;
}

function greeting(name: string | null) {
  const first = name?.trim().split(/\s+/)[0];
  return first ? `Hello ${first},` : "Hello,";
}

async function buildInactivityNudgeEmail(input: {
  founderName: string | null;
  companyName: string;
  metadata: Record<string, unknown>;
  founderId: string;
  companyId: string;
}) {
  const daysInactive =
    typeof input.metadata.daysInactive === "number" ? input.metadata.daysInactive : 7;
  const modules = await listPublishedLearningModules();
  const progressRows = await listLearningProgressForCompany(input.founderId, input.companyId);
  const moduleById = new Map(modules.map((module) => [module.id, module]));
  const inProgress = progressRows
    .filter((row) => row.status === "in_progress")
    .sort((a, b) => {
      const aTime = a.last_viewed_at ? new Date(a.last_viewed_at).getTime() : 0;
      const bTime = b.last_viewed_at ? new Date(b.last_viewed_at).getTime() : 0;
      return bTime - aTime;
    });
  const resumeModule = inProgress[0] ? moduleById.get(inProgress[0].module_id) : null;
  const resumeLine = resumeModule
    ? `Pick up where you left off with "${resumeModule.title}" (${inProgress[0]?.percent_complete ?? 0}% complete).`
    : "Browse your learning catalog and start your next module when you have a few minutes.";

  const subject = `Your CapitalOS learning path — ${daysInactive} days since your last session`;
  const body = appendLearningEmailFooter(`${greeting(input.founderName)}

You haven't logged in to your learning path in ${daysInactive} days. ${resumeLine}

Company: ${input.companyName}

We're here to help you build investor-readiness skills at your own pace — no funding guarantees.`);

  return { subject, body };
}

async function buildMilestoneCelebrationEmail(input: {
  founderName: string | null;
  companyName: string;
  metadata: Record<string, unknown>;
}) {
  const badgeName = typeof input.metadata.badgeName === "string" ? input.metadata.badgeName : null;
  const moduleTitle = typeof input.metadata.moduleTitle === "string" ? input.metadata.moduleTitle : null;
  const milestone = badgeName
    ? `You earned the "${badgeName}" badge`
    : moduleTitle
      ? `You completed "${moduleTitle}"`
      : "You hit a new learning milestone";

  const subject = "Congratulations on your learning milestone";
  const body = appendLearningEmailFooter(`${greeting(input.founderName)}

${milestone} for ${input.companyName}. Keep going — consistent learning progress strengthens your investor-readiness story on CapitalOS.

Open your learning workspace to continue the next recommended module.`);

  return { subject, body };
}

async function buildWeeklyDigestEmail(input: {
  founderName: string | null;
  companyName: string;
  founderId: string;
  companyId: string;
}) {
  const [summaryMap, recommendations] = await Promise.all([
    getLearningAdminSummaryForCompanies([input.companyId]),
    getAICoachRecommendations(input.founderId, input.companyId),
  ]);
  const summary = summaryMap.get(input.companyId) ?? {
    percentComplete: 0,
    modulesEngaged: 0,
    modulesCompleted: 0,
  };
  const nextModule = recommendations[0];

  const subject = `Your weekly CapitalOS learning summary — ${summary.percentComplete}% complete`;
  const body = appendLearningEmailFooter(`${greeting(input.founderName)}

Your weekly learning summary for ${input.companyName}:
- Overall progress: ${summary.percentComplete}% complete
- Modules completed: ${summary.modulesCompleted}
- Modules engaged: ${summary.modulesEngaged}
${nextModule ? `- Next recommended module: ${nextModule.title} — ${nextModule.reason}` : ""}

Sign in to continue your founder academy journey.`);

  return { subject, body };
}

async function buildReminderEmail(
  reminder: LearningReminderRecord,
  founderName: string | null,
  companyName: string,
) {
  const metadata = reminder.metadata ?? {};

  switch (reminder.type) {
    case "inactivity_nudge":
      return buildInactivityNudgeEmail({
        founderName,
        companyName,
        metadata,
        founderId: reminder.founder_id,
        companyId: reminder.company_id,
      });
    case "milestone_celebration":
      return buildMilestoneCelebrationEmail({ founderName, companyName, metadata });
    case "weekly_digest":
      return buildWeeklyDigestEmail({
        founderName,
        companyName,
        founderId: reminder.founder_id,
        companyId: reminder.company_id,
      });
    default:
      throw new Error(`Unsupported reminder type: ${reminder.type as string}`);
  }
}

export async function scheduleReminder(input: {
  founderId: string;
  companyId: string;
  type: LearningReminderType;
  scheduledAt: string;
  metadata?: Record<string, unknown>;
}) {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("learning_reminders")
    .insert({
      founder_id: input.founderId,
      company_id: input.companyId,
      type: input.type,
      scheduled_at: input.scheduledAt,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Failed to schedule reminder: ${error?.message ?? "unknown"}`);
  }

  return data as LearningReminderRecord;
}

export async function getPendingReminders(asOf?: string) {
  const admin = createServiceRoleClient();
  const now = asOf ?? new Date().toISOString();
  const { data, error } = await admin
    .from("learning_reminders")
    .select("*")
    .is("sent_at", null)
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load pending reminders: ${error.message}`);
  }

  return (data ?? []) as LearningReminderRecord[];
}

export async function sendReminder(reminderId: string) {
  const admin = createServiceRoleClient();
  const { data: reminder, error } = await admin
    .from("learning_reminders")
    .select("*")
    .eq("id", reminderId)
    .maybeSingle();

  if (error || !reminder) {
    throw new Error(`Reminder not found: ${error?.message ?? reminderId}`);
  }

  if (reminder.sent_at) {
    return {
      reminder: reminder as LearningReminderRecord,
      alreadySent: true,
      channel: null,
    };
  }

  const [{ data: founder }, { data: company }] = await Promise.all([
    admin.from("profiles").select("full_name, email").eq("id", reminder.founder_id).maybeSingle(),
    admin.from("companies").select("company_name").eq("id", reminder.company_id).maybeSingle(),
  ]);

  if (!founder?.email) {
    throw new Error("Founder email not found for reminder delivery.");
  }

  const companyName = company?.company_name ?? "Your company";
  const { subject, body } = await buildReminderEmail(
    reminder as LearningReminderRecord,
    founder.full_name ?? null,
    companyName,
  );

  const delivery = await sendTransactionalEmail({
    to: founder.email,
    subject,
    body,
    founderId: reminder.founder_id,
    notificationType: `learning.${reminder.type}`,
    deepLink: "/founder/learning",
    entityType: "learning_reminder",
    entityId: reminder.id,
    dedupeKey: `learning_reminder:${reminder.id}`,
  });

  const sentAt = new Date().toISOString();
  const { data: updated, error: updateError } = await admin
    .from("learning_reminders")
    .update({ sent_at: sentAt })
    .eq("id", reminderId)
    .is("sent_at", null)
    .select("*")
    .single();

  if (updateError || !updated) {
    throw new Error(`Reminder sent but failed to mark sent_at: ${updateError?.message ?? "unknown"}`);
  }

  return {
    reminder: updated as LearningReminderRecord,
    alreadySent: false,
    channel: delivery.channel,
  };
}
