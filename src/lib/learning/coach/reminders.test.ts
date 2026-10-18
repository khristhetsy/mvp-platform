import { describe, expect, it } from "vitest";
import { coachMessageCopy, planCoachMessages, type SentMessage } from "@/lib/learning/coach/reminders";
import { COACH_TONES } from "@/lib/learning/coach/tones";
import { enforceCoachRules } from "@/lib/learning/coach/ir-coach";

const DAY = 86_400_000;
const now = new Date("2026-10-26T18:00:00Z");
const ago = (days: number) => new Date(now.getTime() - days * DAY);

describe("planCoachMessages: quiet founder", () => {
  it("sends nothing before 3 days", () => {
    const plan = planCoachMessages({ now, lastActivityAt: ago(2), openCommitments: [], sent: [] });
    expect(plan.send).toHaveLength(0);
  });

  it("sends the in app nudge at 3 days, the email at 7, the human flag at 14", () => {
    const at3 = planCoachMessages({ now, lastActivityAt: ago(3), openCommitments: [], sent: [] });
    expect(at3.send.map((m) => `${m.channel}:${m.stage}`)).toEqual(["in_app:3"]);

    const at7 = planCoachMessages({ now, lastActivityAt: ago(7), openCommitments: [], sent: [] });
    expect(at7.send.map((m) => `${m.channel}:${m.stage}`)).toEqual(["in_app:3", "email:7"]);

    const at14 = planCoachMessages({ now, lastActivityAt: ago(14), openCommitments: [], sent: [] });
    expect(at14.send.some((m) => m.humanFlag && m.stage === 14)).toBe(true);
  });

  it("never repeats a stage that was already sent since the founder was last active", () => {
    const sent: SentMessage[] = [
      { kind: "quiet_founder", channel: "in_app", createdAt: ago(4), metadata: { stage: 3 } },
      { kind: "quiet_founder", channel: "email", createdAt: ago(0.1), metadata: { stage: 7 } },
    ];
    const plan = planCoachMessages({ now, lastActivityAt: ago(8), openCommitments: [], sent });
    expect(plan.send).toHaveLength(0);
  });

  it("starts a fresh sequence when a founder returns and goes quiet again", () => {
    const sent: SentMessage[] = [{ kind: "quiet_founder", channel: "in_app", createdAt: ago(20), metadata: { stage: 3 } }];
    const plan = planCoachMessages({ now, lastActivityAt: ago(3), openCommitments: [], sent });
    expect(plan.send.map((m) => m.stage)).toEqual([3]);
  });
});

describe("planCoachMessages: commitments", () => {
  const c = { id: "c1", title: "Send first three messages", courseSlug: "investor-outreach-playbook" };

  it("waits until the chosen time", () => {
    const plan = planCoachMessages({ now, lastActivityAt: now, openCommitments: [{ ...c, dueAt: new Date(now.getTime() + 3_600_000) }], sent: [] });
    expect(plan.send).toHaveLength(0);
  });

  it("checks in when due, emails a day later, and marks it missed after two days", () => {
    const due = (days: number) => new Date(now.getTime() - days * DAY);
    const p0 = planCoachMessages({ now, lastActivityAt: now, openCommitments: [{ ...c, dueAt: due(0.01) }], sent: [] });
    expect(p0.send.map((m) => m.channel)).toEqual(["in_app"]);
    expect(p0.missedCommitmentIds).toEqual([]);

    const sentInApp: SentMessage[] = [{ kind: "commitment_check", channel: "in_app", createdAt: due(1), metadata: { commitment_id: "c1" } }];
    const p1 = planCoachMessages({ now, lastActivityAt: now, openCommitments: [{ ...c, dueAt: due(1) }], sent: sentInApp });
    expect(p1.send.map((m) => m.channel)).toEqual(["email"]);

    const p2 = planCoachMessages({ now, lastActivityAt: now, openCommitments: [{ ...c, dueAt: due(2) }], sent: sentInApp });
    expect(p2.missedCommitmentIds).toEqual(["c1"]);
  });
});

describe("coachMessageCopy", () => {
  it("stays inside the coach rules in every style", () => {
    for (const tone of COACH_TONES) {
      for (const msg of [
        { kind: "commitment_check" as const, commitmentTitle: "Send first three messages" },
        { kind: "quiet_founder" as const, stage: 3 },
        { kind: "quiet_founder" as const, stage: 7 },
      ]) {
        const { title, message } = coachMessageCopy(msg, tone);
        expect(enforceCoachRules(message, tone)).toBe(message);
        expect(`${title} ${message}`).not.toMatch(/—/);
      }
    }
  });
});
