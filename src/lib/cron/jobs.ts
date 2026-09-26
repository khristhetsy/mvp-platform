/**
 * The scheduled jobs, read from vercel.json so a job added there shows up on
 * Admin, System, Scheduled jobs without another edit. The labels below only
 * name and group them; a path missing here still appears, under "Other".
 */
import vercel from "../../../vercel.json";

export type CronGroup = "Founders" | "Platform" | "Marketing" | "Sales" | "Meetings" | "Events" | "CEO" | "Other";

export const CRON_GROUP_ORDER: CronGroup[] = ["Founders", "Platform", "Marketing", "Sales", "Meetings", "Events", "CEO", "Other"];

type Label = { name: string; group: CronGroup; description?: string };

const LABELS: Record<string, Label> = {
  "/api/cron/founder-nudges": { name: "Founder nudges", group: "Founders", description: "Data room reminders, journey nudges and stage gate reminders" },
  "/api/cron/founder-match-digest": { name: "Weekly match email", group: "Founders", description: "New investor matches for paying founders" },
  "/api/cron/intro-follow-ups": { name: "Intro follow ups", group: "Founders", description: "Chases introductions in both directions" },
  "/api/cron/ir-summaries": { name: "Founder summaries", group: "Founders", description: "Weekly and milestone summaries that are due" },
  "/api/cron/matching": { name: "Matching pass", group: "Platform", description: "Suggested matches for eligible founders and approved investors" },
  "/api/cron/run-orchestration": { name: "Orchestration", group: "Platform", description: "Digests, match notices, outreach sends and automations" },
  "/api/cron/activity-escalations": { name: "Activity escalations", group: "Platform", description: "Chases account activity alerts nobody has opened" },
  "/api/cron/operations-escalations": { name: "Operations escalations", group: "Platform" },
  "/api/cron/sync-contacts": { name: "Contact sync", group: "Platform", description: "Pulls changed contacts from each configured source" },
  "/api/cron/points-expiry": { name: "Points expiry", group: "Platform", description: "iCFO Points expiry sweep" },
  "/api/cron/social-queue": { name: "Social publishing", group: "Marketing", description: "Publishes due social posts, with retries" },
  "/api/cron/social-maintenance": { name: "Social maintenance", group: "Marketing" },
  "/api/marketing/process-sequences": { name: "Email sequences", group: "Marketing", description: "Collects due contacts into batches for review" },
  "/api/marketing/process-scheduled": { name: "Scheduled campaigns", group: "Marketing", description: "Sends campaigns whose scheduled time has passed" },
  "/api/cron/marketing-notifications": { name: "Marketing reminders", group: "Marketing" },
  "/api/cron/sales-forecast-rollup": { name: "Forecast rollup", group: "Sales" },
  "/api/cron/voice-cadence": { name: "Voice cadence", group: "Sales", description: "Fires due multichannel cadence steps" },
  "/api/cron/meeting-reminders": { name: "Meeting reminders", group: "Meetings" },
  "/api/cron/meeting-readiness-reminders": { name: "Meeting readiness reminders", group: "Meetings" },
  "/api/cron/meeting-kpi-goals": { name: "Meeting KPI goals", group: "Meetings" },
  "/api/cron/event-invite-reminders": { name: "Presenter reminders", group: "Events", description: "Chases accepted presenters who still owe materials" },
  "/api/ceo/briefing": { name: "CEO briefing", group: "CEO" },
  "/api/cron/weekly-funnel-digest": { name: "Weekly funnel digest", group: "CEO", description: "Activation funnel report to staff" },
};

export type CronJob = Label & { path: string; schedules: string[] };

/** One entry per path; a path scheduled twice (orchestration) carries both expressions. */
export function listCronJobs(): CronJob[] {
  const crons = ((vercel as { crons?: Array<{ path: string; schedule: string }> }).crons ?? []);
  const byPath = new Map<string, string[]>();
  for (const c of crons) byPath.set(c.path, [...(byPath.get(c.path) ?? []), c.schedule]);
  return [...byPath.entries()].map(([path, schedules]) => ({
    path,
    schedules,
    ...(LABELS[path] ?? { name: path.replace(/^\/api\/(cron\/)?/, ""), group: "Other" as const }),
  }));
}

export function isCronPath(path: string): boolean {
  return listCronJobs().some((j) => j.path === path);
}
