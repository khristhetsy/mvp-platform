import { describe, expect, it } from "vitest";
import { parseTriage } from "./triage-parse";

describe("parseTriage", () => {
  it("reads the JSON even with text around it", () => {
    expect(
      parseTriage('Here you go: {"topic":"Financial model review","priority":"normal","canAiAnswer":false,"reason":"About their numbers"}'),
    ).toEqual({ topic: "Financial model review", priority: "normal", canAiAnswer: false, reason: "About their numbers" });
  });

  it("defaults odd values safely", () => {
    expect(parseTriage('{"topic":"Data room","priority":"urgent","canAiAnswer":"yes"}')).toEqual({
      topic: "Data room",
      priority: "normal",
      canAiAnswer: false,
      reason: "",
    });
  });

  it("rejects replies without a topic or JSON", () => {
    expect(parseTriage("no json here")).toBeNull();
    expect(parseTriage('{"priority":"high"}')).toBeNull();
  });
});
