import { describe, it, expect } from "vitest";
import { AGENT_IDLE_LINES, AGENT_OPTOUT_LINES, IDLE_MS, isOptOut, replyPauseMs, typingMs } from "./presence";

describe("isOptOut", () => {
  it("stops on any request to be removed or left alone", () => {
    for (const t of ["remove me", "Please unsubscribe", "take me off your list", "stop contacting me", "do not contact me", "don't email me", "leave me alone"]) {
      expect(isOptOut(t)).toBe(true);
    }
  });
  it("does not stop on ordinary talk", () => {
    for (const t of ["how does it work", "I want to stop by next week", "not interested", "what does it cost"]) {
      expect(isOptOut(t)).toBe(false);
    }
  });
});

describe("pacing", () => {
  it("pauses one to two seconds before a reply, never instantly", () => {
    expect(replyPauseMs(0)).toBe(1200);
    expect(replyPauseMs(1)).toBe(2000);
    expect(replyPauseMs(5)).toBe(2000);
    expect(replyPauseMs(-1)).toBe(1200);
  });
  it("types the opening quickly and later replies at a human pace", () => {
    expect(typingMs(40, true)).toBeLessThan(typingMs(40, false));
    expect(typingMs(40, true)).toBe(800);
    expect(typingMs(40, false)).toBe(1320);
    expect(typingMs(500, false)).toBe(2400);
  });
});

describe("copy", () => {
  it("checks in after five minutes with lines that never offer a call", () => {
    expect(IDLE_MS).toBe(300000);
    expect(AGENT_IDLE_LINES.join(" ")).not.toMatch(/book|call|schedule/i);
  });
  it("the opt out reply promises no follow up and has no dashes", () => {
    expect(AGENT_OPTOUT_LINES.join(" ")).toMatch(/will not follow up/);
    expect(AGENT_OPTOUT_LINES.join(" ")).not.toMatch(/[-–—]/);
  });
});
