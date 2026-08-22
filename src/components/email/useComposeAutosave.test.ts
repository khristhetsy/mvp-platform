import { describe, it, expect } from "vitest";
import { backoffDelay, AUTOSAVE_DEBOUNCE_MS } from "./useComposeAutosave";

describe("autosave retry schedule", () => {
  it("debounces at 3 seconds", () => {
    expect(AUTOSAVE_DEBOUNCE_MS).toBe(3000);
  });

  it("grows exponentially then caps", () => {
    expect(backoffDelay(0)).toBe(2000);
    expect(backoffDelay(1)).toBe(4000);
    expect(backoffDelay(2)).toBe(8000);
    // caps at the last entry for any further retries
    expect(backoffDelay(10)).toBe(30000);
  });

  it("clamps negative input", () => {
    expect(backoffDelay(-5)).toBe(2000);
  });
});
