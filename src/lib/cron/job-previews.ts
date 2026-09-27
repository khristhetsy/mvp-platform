import "server-only";

/**
 * Dry runs behind a job's Next run tab on Scheduled jobs: who the next run would
 * contact and with what, built by the same code the job sends from. Nothing is
 * sent. Jobs not listed here have no preview.
 */
import { planJourneyNudges } from "@/lib/notifications/founder-nudges";

export type PreviewItem = {
  recipientName: string | null;
  toEmail: string | null;
  companyName: string | null;
  subject: string;
  channels: Array<"email" | "in_app">;
  /** In-app text. */
  message: string;
  /** Email body, when an email would go out. */
  html: string | null;
};

export const JOB_PREVIEWS: Record<string, { label: string; note: string; load: () => Promise<PreviewItem[]> }> = {
  "/api/cron/founder-nudges": {
    label: "Journey nudges",
    note: "Journey nudges only. Data room and stage gate reminders from the same job aren't previewed yet.",
    load: async () =>
      (await planJourneyNudges()).map((p) => ({
        recipientName: p.founderName,
        toEmail: p.email,
        companyName: p.companyName,
        subject: p.notification.title,
        channels: p.mail ? (["email", "in_app"] as const).slice() : (["in_app"] as const).slice(),
        message: p.notification.message,
        html: p.mail?.html ?? null,
      })),
  },
};
