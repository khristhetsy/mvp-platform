import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ir/db", () => ({ createActivity: vi.fn(), db: vi.fn(), updateMatch: vi.fn() }));
import { callActivityFor, pickMatch, stageAfterCall } from "./call-log";

describe("callActivityFor", () => {
  it("classifies outcomes", () => {
    expect(callActivityFor("connected")).toMatchObject({ type: "call", reached: true });
    expect(callActivityFor("voicemail")).toMatchObject({ type: "voicemail", reached: false });
    expect(callActivityFor("no_answer")).toMatchObject({ type: "call", reached: false, label: "no answer" });
    expect(callActivityFor("wrong_number")).toMatchObject({ reached: false });
    expect(callActivityFor("booked")).toMatchObject({ type: "call", reached: true });
  });
});

describe("stageAfterCall", () => {
  it("moves forward only", () => {
    expect(stageAfterCall("matched", true)).toBe("contacted");
    expect(stageAfterCall("intro_sent", true)).toBe("contacted");
    expect(stageAfterCall("matched", false)).toBe("intro_sent");
    expect(stageAfterCall("intro_sent", false)).toBeNull();
    expect(stageAfterCall("meeting_scheduled", true)).toBeNull();
    expect(stageAfterCall("passed", true)).toBeNull();
  });
});

describe("pickMatch", () => {
  const row = (id: string, project_id: string, updated_at: string) => ({ id, project_id, task_id: null, stage: "contacted" as const, assignee_id: null, updated_at });
  it("logs on the most recently worked record of an active project", () => {
    const rows = [row("a", "p1", "2026-09-20T00:00:00Z"), row("b", "p2", "2026-09-27T00:00:00Z"), row("c", "p3", "2026-09-28T00:00:00Z")];
    expect(pickMatch(rows, new Set(["p1", "p2"]))?.id).toBe("b");
    expect(pickMatch(rows, new Set())).toBeNull();
  });
});
