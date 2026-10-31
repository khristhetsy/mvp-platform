import { describe, expect, it } from "vitest";
import { addDays, dayKey, rankQueue, scoreCandidate, STALE_DAYS, type QueueCandidate } from "./queue";

const now = new Date("2026-10-31T09:00:00Z");
const ago = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();

const base: QueueCandidate = {
  id: "a", stageName: "Proposal", createdAt: ago(60), lastActivityAt: ago(1), pendingSuggestions: 0, chatCount: 0, lastChatAt: null,
  lastEmailSentAt: null, openDraft: false, snoozed: false,
};
const c = (over: Partial<QueueCandidate>): QueueCandidate => ({ ...base, ...over });

describe("scoreCandidate", () => {
  it("has no reasons for a recently touched opportunity", () => {
    expect(scoreCandidate(base, now).reasons).toEqual([]);
  });

  it("flags a waiting stage move above everything else", () => {
    const r = scoreCandidate(c({ pendingSuggestions: 1 }), now);
    expect(r.score).toBe(50);
    expect(r.reasons[0].code).toBe("suggestion");
  });

  it("flags a chat after the last email, or any chat when never emailed", () => {
    expect(scoreCandidate(c({ chatCount: 1, lastChatAt: ago(1), lastEmailSentAt: ago(3) }), now).reasons.map((x) => x.code)).toEqual(["chat_new"]);
    expect(scoreCandidate(c({ chatCount: 1, lastChatAt: ago(1), lastEmailSentAt: null }), now).reasons.map((x) => x.code)).toEqual(["chat_new"]);
  });

  it("does not flag a chat that came before the last email", () => {
    expect(scoreCandidate(c({ chatCount: 1, lastChatAt: ago(5), lastEmailSentAt: ago(2) }), now).reasons).toEqual([]);
  });

  it("flags staleness from the threshold, capped at 30 points", () => {
    expect(scoreCandidate(c({ lastActivityAt: ago(STALE_DAYS - 1) }), now).reasons).toEqual([]);
    expect(scoreCandidate(c({ lastActivityAt: ago(STALE_DAYS) }), now).score).toBe(STALE_DAYS);
    expect(scoreCandidate(c({ lastActivityAt: ago(54) }), now).score).toBe(30);
  });

  it("uses the age of the record when nothing is logged, and says so", () => {
    const r = scoreCandidate(c({ lastActivityAt: null, createdAt: ago(20) }), now);
    expect(r.reasons[0].text).toContain("since it was created 20 days ago");
  });

  it("flags a new opportunity nobody has emailed", () => {
    const r = scoreCandidate(c({ stageName: "New opportunity", createdAt: ago(2), lastActivityAt: null }), now);
    expect(r.reasons.map((x) => x.code)).toEqual(["fresh"]);
  });

  it("flags a ready draft", () => {
    expect(scoreCandidate(c({ openDraft: true }), now).reasons.map((x) => x.code)).toEqual(["draft"]);
  });
});

describe("rankQueue", () => {
  it("orders by score, then by how long it has waited", () => {
    const out = rankQueue(
      [c({ id: "stale10", lastActivityAt: ago(10) }), c({ id: "stale30", lastActivityAt: ago(30) }), c({ id: "move", pendingSuggestions: 1 })],
      now,
    );
    expect(out.map((e) => e.opportunityId)).toEqual(["move", "stale30", "stale10"]);
    expect(out.map((e) => e.rank)).toEqual([1, 2, 3]);
  });

  it("breaks a tie by the longer wait", () => {
    // Both are capped at 30 points, so only the wait separates them.
    const out = rankQueue([c({ id: "x", lastActivityAt: ago(40) }), c({ id: "y", lastActivityAt: ago(45) })], now);
    expect(out.map((e) => e.opportunityId)).toEqual(["y", "x"]);
  });

  it("leaves out snoozed and reason-less opportunities", () => {
    const out = rankQueue([c({ id: "snoozed", lastActivityAt: ago(30), snoozed: true }), c({ id: "fine" })], now);
    expect(out).toEqual([]);
  });

  it("keeps only the stored limit", () => {
    const many = Array.from({ length: 40 }, (_, i) => c({ id: `o${String(i).padStart(2, "0")}`, lastActivityAt: ago(10 + i) }));
    expect(rankQueue(many, now)).toHaveLength(25);
  });

  it("is the same every time for the same facts", () => {
    const list = [c({ id: "b", lastActivityAt: ago(12) }), c({ id: "a", lastActivityAt: ago(12) })];
    expect(rankQueue(list, now)).toEqual(rankQueue([...list].reverse(), now));
  });
});

describe("day helpers", () => {
  it("keys a day in UTC and adds days across a month end", () => {
    expect(dayKey(now)).toBe("2026-10-31");
    expect(addDays("2026-10-31", 3)).toBe("2026-11-03");
  });
});
