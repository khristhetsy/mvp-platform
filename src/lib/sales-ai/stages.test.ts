import { describe, expect, it } from "vitest";
import { isAgentStage, stagePatchFor, suggestMoves, type StageLite } from "./stages";

const stages: StageLite[] = [
  { id: "new", name: "New opportunity", sort_order: 0, is_won: false },
  { id: "qual", name: "Qualified - Sent invitation", sort_order: 1, is_won: false },
  { id: "meet", name: "Meeting", sort_order: 2, is_won: false },
  { id: "prop", name: "Proposal", sort_order: 4, is_won: false },
  { id: "pend", name: "Pending", sort_order: 5, is_won: false },
  { id: "nego", name: "Negotiation", sort_order: 6, is_won: false },
  { id: "won", name: "Won", sort_order: 8, is_won: true },
  { id: "loss", name: "Loss", sort_order: 9, is_won: false },
];

describe("isAgentStage", () => {
  it("is on for the five active stages", () => {
    expect(stages.filter(isAgentStage).map((s) => s.id)).toEqual(["new", "qual", "meet", "prop", "nego"]);
  });
  it("is off for Pending, Won and Loss", () => {
    for (const id of ["pend", "won", "loss"]) expect(isAgentStage(stages.find((s) => s.id === id)!)).toBe(false);
  });
});

describe("suggestMoves", () => {
  it("suggests Meeting when a time was booked from an earlier stage", () => {
    expect(suggestMoves(stages, "qual", { booked: true, stopped: false })).toEqual([
      { toStageId: "meet", source: "chat_booked", reason: expect.any(String) },
    ]);
  });
  it("never moves backward", () => {
    expect(suggestMoves(stages, "prop", { booked: true, stopped: false })).toEqual([]);
  });
  it("suggests Loss when the chat was stopped, never Won", () => {
    const moves = suggestMoves(stages, "meet", { booked: false, stopped: true });
    expect(moves.map((m) => m.toStageId)).toEqual(["loss"]);
  });
  it("suggests nothing from a stage the agent is off in", () => {
    for (const id of ["pend", "won", "loss"]) expect(suggestMoves(stages, id, { booked: true, stopped: true })).toEqual([]);
  });
  it("suggests nothing without a current stage", () => {
    expect(suggestMoves(stages, null, { booked: true, stopped: true })).toEqual([]);
  });
});

describe("stagePatchFor", () => {
  it("marks the opportunity lost when moving to Loss", () => {
    expect(stagePatchFor(stages[7])).toEqual({ stageId: "loss", status: "lost" });
  });
  it("only changes the stage otherwise", () => {
    expect(stagePatchFor(stages[2])).toEqual({ stageId: "meet" });
  });
});
