import { describe, expect, it } from "vitest";
import { DEFAULT_SUPPORT_SETTINGS, normalizeSupportSettings } from "./settings";

const A = "11111111-1111-4111-8111-111111111111";

describe("normalizeSupportSettings", () => {
  it("returns the defaults for a missing row", () => {
    expect(normalizeSupportSettings(null)).toEqual(DEFAULT_SUPPORT_SETTINGS);
  });

  it("keeps the assistant answering by default, as it does today", () => {
    expect(normalizeSupportSettings({}).ai.answerFounders).toBe(true);
  });

  it("drops bad and duplicate recipients", () => {
    const s = normalizeSupportSettings({
      recipients: [{ userId: A, inApp: true, email: true }, { userId: A, email: false }, { userId: "nope" }],
    });
    expect(s.recipients).toEqual([{ userId: A, inApp: true, email: true }]);
  });

  it("only accepts the offered reminder intervals", () => {
    expect(normalizeSupportSettings({ reminders: { everyHours: 8 } }).reminders.everyHours).toBe(8);
    expect(normalizeSupportSettings({ reminders: { everyHours: 3 } }).reminders.everyHours).toBe(4);
  });
});
