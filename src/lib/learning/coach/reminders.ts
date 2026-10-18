import { type CoachTone } from "@/lib/learning/coach/tones";

/**
 * AI IR Coach reminders. This file is the pure part: what to send and what to say.
 * Sending (notifications, preferences, email budget, internal accounts) is in reminders-pass.ts.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Agreed with Khris on Oct 18, 2026: in app at 3 days, email at 7 days, human flag at 14 days. */
export const QUIET_FOUNDER_DAYS = { inApp: 3, email: 7, humanFlag: 14 } as const;

/** A "Not now" commitment: in app when it falls due, email a day later, marked missed after two days. */
export const COMMITMENT_EMAIL_AFTER_MS = DAY_MS;
export const COMMITMENT_MISSED_AFTER_MS = 2 * DAY_MS;

export type PlannedKind = "commitment_check" | "quiet_founder";
export type PlannedChannel = "in_app" | "email";

export type PlannedMessage = {
  kind: PlannedKind;
  channel: PlannedChannel;
  /** Quiet founder stage in days (3, 7, 14). */
  stage?: number;
  /** True for the 14 day stage: a person at iCFO should reach out. Not sent to the founder. */
  humanFlag?: boolean;
  commitmentId?: string;
  commitmentTitle?: string;
  courseSlug?: string;
};

export type OpenCommitment = {
  id: string;
  title: string;
  courseSlug: string;
  dueAt: Date;
};

export type SentMessage = {
  kind: string;
  channel: string;
  createdAt: Date;
  metadata: { stage?: number; commitment_id?: string } | null;
};

export type PlanInput = {
  now: Date;
  /** Latest of the founder's step events, commitments and enrollment start. */
  lastActivityAt: Date;
  openCommitments: OpenCommitment[];
  /** Messages already created for this founder, so nothing repeats. */
  sent: SentMessage[];
  /** A course slug to link to when a message has no commitment. */
  defaultCourseSlug?: string;
};

export type Plan = { send: PlannedMessage[]; missedCommitmentIds: string[] };

function alreadySent(sent: SentMessage[], test: (m: SentMessage) => boolean) {
  return sent.some(test);
}

export function planCoachMessages(input: PlanInput): Plan {
  const send: PlannedMessage[] = [];
  const missedCommitmentIds: string[] = [];
  const now = input.now.getTime();

  for (const c of input.openCommitments) {
    const due = c.dueAt.getTime();
    if (due > now) continue;
    const base = { kind: "commitment_check" as const, commitmentId: c.id, commitmentTitle: c.title, courseSlug: c.courseSlug };
    const forThis = (channel: PlannedChannel) => (m: SentMessage) =>
      m.kind === "commitment_check" && m.channel === channel && m.metadata?.commitment_id === c.id;

    if (!alreadySent(input.sent, forThis("in_app"))) send.push({ ...base, channel: "in_app" });
    if (now >= due + COMMITMENT_EMAIL_AFTER_MS && !alreadySent(input.sent, forThis("email"))) {
      send.push({ ...base, channel: "email" });
    }
    if (now >= due + COMMITMENT_MISSED_AFTER_MS) missedCommitmentIds.push(c.id);
  }

  // Quiet founder: only count messages sent since the founder was last active, so a founder who
  // comes back and goes quiet again gets a fresh sequence.
  const quietDays = Math.floor((now - input.lastActivityAt.getTime()) / DAY_MS);
  const sinceActive = input.sent.filter((m) => m.kind === "quiet_founder" && m.createdAt.getTime() > input.lastActivityAt.getTime());
  const stageDone = (stage: number) => sinceActive.some((m) => m.metadata?.stage === stage);

  if (quietDays >= QUIET_FOUNDER_DAYS.inApp && !stageDone(QUIET_FOUNDER_DAYS.inApp)) {
    send.push({ kind: "quiet_founder", channel: "in_app", stage: QUIET_FOUNDER_DAYS.inApp, courseSlug: input.defaultCourseSlug });
  }
  if (quietDays >= QUIET_FOUNDER_DAYS.email && !stageDone(QUIET_FOUNDER_DAYS.email)) {
    send.push({ kind: "quiet_founder", channel: "email", stage: QUIET_FOUNDER_DAYS.email, courseSlug: input.defaultCourseSlug });
  }
  if (quietDays >= QUIET_FOUNDER_DAYS.humanFlag && !stageDone(QUIET_FOUNDER_DAYS.humanFlag)) {
    send.push({ kind: "quiet_founder", channel: "in_app", stage: QUIET_FOUNDER_DAYS.humanFlag, humanFlag: true });
  }

  return { send, missedCommitmentIds };
}

export type Copy = { title: string; message: string };

/**
 * Words for each message in each style. Aggressive about action, never about the person, and no
 * promise of any result. Each ends with one concrete next action.
 */
export function coachMessageCopy(
  msg: Pick<PlannedMessage, "kind" | "stage" | "commitmentTitle">,
  tone: CoachTone,
): Copy {
  if (msg.kind === "commitment_check") {
    const what = msg.commitmentTitle ?? "your step";
    const t: Record<CoachTone, Copy> = {
      encouraging: {
        title: "Ready for your next step?",
        message: `You planned to do "${what}" about now. Take five minutes and start it. A small start counts.`,
      },
      driven: {
        title: "It is time for your step",
        message: `You said you would do "${what}" now. Open it and do the first action today.`,
      },
      relentless: {
        title: "You set this time yourself",
        message: `"${what}" was due. Open it now, do the first action, then mark it done.`,
      },
    };
    return t[tone];
  }

  const days = msg.stage ?? QUIET_FOUNDER_DAYS.inApp;
  const t: Record<CoachTone, Copy> = {
    encouraging: {
      title: "Your outreach plan is waiting",
      message: `It has been ${days} days since your last step. Pick one small action today and the habit starts again.`,
    },
    driven: {
      title: `${days} days without a step`,
      message: `Your outreach has paused for ${days} days. Choose one step, set a time, and do it today.`,
    },
    relentless: {
      title: `${days} days. Move now`,
      message: `Nothing done in ${days} days. Open your next step and finish it today.`,
    },
  };
  return t[tone];
}
