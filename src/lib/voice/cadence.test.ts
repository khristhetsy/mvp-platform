import { describe, it, expect } from "vitest";
import { advance } from "./cadence";
import type { CadenceStep } from "@/lib/voice/types";

const steps: CadenceStep[] = [
  { channel: "voice", delayHours: 0 },
  { channel: "sms", delayHours: 48 },
  { channel: "whatsapp", delayHours: 72 },
];
const T0 = Date.parse("2026-08-25T12:00:00Z");

describe("cadence advance", () => {
  it("sent → moves to next step, scheduled by its delay", () => {
    const r = advance(0, steps, "sent", T0);
    expect(r.status).toBe("active");
    expect(r.currentStep).toBe(1);
    expect(Date.parse(r.nextRunAt)).toBe(T0 + 48 * 3600 * 1000);
  });

  it("sent on the last step → completed", () => {
    const r = advance(2, steps, "sent", T0);
    expect(r.status).toBe("completed");
  });

  it("skip advances the same as sent (no send happened)", () => {
    const r = advance(0, steps, "skip", T0);
    expect(r.status).toBe("active");
    expect(r.currentStep).toBe(1);
  });

  it("retry holds the step and reschedules +1h", () => {
    const r = advance(1, steps, "retry", T0);
    expect(r.status).toBe("active");
    expect(r.currentStep).toBe(1);
    expect(Date.parse(r.nextRunAt)).toBe(T0 + 3600 * 1000);
  });

  it("stop ends the enrollment", () => {
    const r = advance(1, steps, "stop", T0);
    expect(r.status).toBe("stopped");
    expect(r.currentStep).toBe(1);
  });
});
