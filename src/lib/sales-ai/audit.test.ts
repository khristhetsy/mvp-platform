import { describe, expect, it } from "vitest";
import { buildAudit, chatUserMessages, threadText, type ChatConv } from "./audit";
import type { TimelineItem } from "@/lib/sales/chatter-merge";

const item = (over: Partial<TimelineItem>): TimelineItem => ({
  id: "1", kind: "email", summary: "Email sent: Hello", actor_name: "Khris", created_at: "2026-10-24T10:00:00Z",
  group: "message", source: "icapos", origin: null, editable: false, edited_at: null, deleted_at: null, odoo_synced: false, via: null, ...over,
});

const chat = (over: Partial<ChatConv> = {}): ChatConv => ({
  id: "c1", transcript: [{ role: "assistant", content: "Hi" }, { role: "user", content: "How long does it take?" }], booked: false, stopped: false, updatedAt: "2026-10-25T10:00:00Z", ...over,
});

const opp = { title: "Acme", contact_email: "dana@acme.test", value_cents: null, expected_close: null };

describe("buildAudit", () => {
  it("says what the record does not hold instead of filling it in", () => {
    const a = buildAudit({ opportunity: opp, stageName: "Meeting", items: [], chats: [], quotes: { asked: null, concern: null }, aiRead: true });
    expect(a.notOnFile).toEqual(["Deal value", "Expected close date"]);
    expect(a.objection).toBe("unknown");
  });

  it("flags when the AI reading is not configured", () => {
    const a = buildAudit({ opportunity: opp, stageName: "Meeting", items: [], chats: [], quotes: { asked: null, concern: null }, aiRead: false });
    expect(a.aiRead).toBe(false);
    expect(a.notOnFile.some((n) => n.includes("own words"))).toBe(true);
  });

  it("marks quotes as the prospect's words and reads the objection from them", () => {
    const a = buildAudit({
      opportunity: opp, stageName: "Meeting", items: [item({})], chats: [],
      quotes: { asked: "how long does this take", concern: "I would rather not pay before I know it works" }, aiRead: true,
    });
    expect(a.points.filter((p) => p.quote).map((p) => p.label)).toEqual(["They asked", "Concern"]);
    expect(a.objection).toBe("money");
    expect(a.closingQuestion).toBe("What would it take to move forward?");
  });

  it("reports the agent chat, including a booked time", () => {
    const a = buildAudit({ opportunity: opp, stageName: "Qualified", items: [], chats: [chat({ booked: true })], quotes: { asked: null, concern: null }, aiRead: true });
    const p = a.points.find((x) => x.label === "Agent chat");
    expect(p?.text).toBe("Chatted with the agent 1 time, booked a time.");
  });

  it("counts each channel it read", () => {
    const a = buildAudit({
      opportunity: opp, stageName: "Meeting",
      items: [item({}), item({ id: "2", kind: "note" }), item({ id: "3", kind: "call" })], chats: [chat()],
      quotes: { asked: null, concern: null }, aiRead: true,
    });
    expect(a.channels).toEqual([
      { name: "Email and messages", count: 1, read: true },
      { name: "Notes", count: 1, read: true },
      { name: "Calls", count: 1, read: true },
      { name: "Agent chat", count: 1, read: true },
    ]);
  });
});

describe("threadText", () => {
  it("includes the prospect's chat messages but not the agent's", () => {
    const t = threadText([item({})], [chat()]);
    expect(t).toContain("prospect: How long does it take?");
    expect(t).not.toContain("Hi");
  });
  it("lists the prospect's chat messages for objection reading", () => {
    expect(chatUserMessages([chat()])).toEqual(["How long does it take?"]);
  });
});
