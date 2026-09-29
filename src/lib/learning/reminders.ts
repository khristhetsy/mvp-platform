import { sendTransactionalEmail } from "@/lib/email/transactional-send";
import { renderEmail, type EmailBlock, type RenderedEmail } from "@/lib/email/layout";
import { getAppUrl } from "@/lib/env";
import { getAICoachRecommendations } from "@/lib/learning/recommendations";
import {
  getLearningAdminSummaryForCompanies,
  listLearningProgressForCompany,
  listPublishedLearningModules,
} from "@/lib/learning/progress";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { LearningReminderRecord, LearningReminderType } from "@/lib/learning/types";

function learningUrl(): string {
  return `${(getAppUrl() ?? "http://localhost:3000").replace(/\/$/, "")}/founder/learning`;
}

function firstName(name: string | null): string | null {
  return name?.trim().split(/\s+/)[0] || null;
}

/** Shared frame for the three learning emails. Pure. */
export function buildLearningEmail(input: {
  subject: string;
  preheader: string;
  eyebrow: string;
  headline: string;
  intro: string;
  companyName: string;
  blocks?: EmailBlock[];
  cta: string;
}): RenderedEmail {
  return renderEmail({
    audience: "founder",
    subject: input.subject,
    preheader: input.preheader,
    context: "Learning path",
    eyebrow: input.eyebrow,
    headline: input.headline,
    intro: input.intro,
    blocks: input.blocks,
    primary: { label: input.cta, url: learningUrl() },
    footer: {
      reason: `You get this because ${input.companyName} is on the iCapOS founder learning path.`,
      preferencesUrl: "/founder/settings",
      lines: ["Educational content only, not legal, tax, or investment advice. No funding guarantees."],
    },
  });
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
  const name = firstName(input.founderName);
  const pct = inProgress[0]?.percent_complete ?? 0;
  return buildLearningEmail({
    subject: `Your learning path: ${daysInactive} days since your last session`,
    preheader: resumeModule ? `Pick up "${resumeModule.title}" where you left off (${pct}% complete).` : "Start your next module when you have a few minutes.",
    eyebrow: "Learning",
    headline: resumeModule ? "Pick up where you left off" : "Your next module is waiting",
    intro: `${name ? `Hi ${name}, y` : "Y"}ou haven't opened your learning path in ${daysInactive} days.`,
    companyName: input.companyName,
    blocks: resumeModule
      ? [{ type: "progress", label: resumeModule.title, value: `${pct}% complete`, percent: pct }]
      : [{ type: "paragraph", text: "Browse your learning catalog and start your next module when you have a few minutes." }],
    cta: resumeModule ? "Resume module" : "Browse the catalog",
  });
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

  const name = firstName(input.founderName);
  return buildLearningEmail({
    subject: badgeName ? `You earned the "${badgeName}" badge` : "Congratulations on your learning milestone",
    preheader: `${milestone} for ${input.companyName}. Your next recommended module is ready.`,
    eyebrow: "Learning · Milestone",
    headline: `${milestone}`,
    intro: `${name ? `Nice work, ${name}. ` : "Nice work. "}Consistent learning progress strengthens your investor readiness story on iCapOS.`,
    companyName: input.companyName,
    cta: "Continue learning",
  });
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

  const name = firstName(input.founderName);
  const blocks: EmailBlock[] = [
    {
      type: "stats",
      items: [
        { value: `${summary.percentComplete}%`, label: "overall progress" },
        { value: String(summary.modulesCompleted), label: "modules completed" },
        { value: String(summary.modulesEngaged), label: "modules engaged" },
      ],
    },
  ];
  if (nextModule) blocks.push({ type: "note", text: `Next recommended: ${nextModule.title}. ${nextModule.reason}` });
  return buildLearningEmail({
    subject: `Your weekly learning summary: ${summary.percentComplete}% complete`,
    preheader: `${summary.modulesCompleted} completed, ${summary.modulesEngaged} engaged${nextModule ? `. Next: ${nextModule.title}` : ""}.`,
    eyebrow: "Learning · Weekly",
    headline: "Your learning this week",
    intro: `${name ? `Hi ${name}, h` : "H"}ere is your weekly summary for ${input.companyName}.`,
    companyName: input.companyName,
    blocks,
    cta: "Open learning workspace",
  });
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
  const { subject, text, html } = await buildReminderEmail(
    reminder as LearningReminderRecord,
    founder.full_name ?? null,
    companyName,
  );

  const delivery = await sendTransactionalEmail({
    to: founder.email,
    subject,
    body: text,
    html,
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
