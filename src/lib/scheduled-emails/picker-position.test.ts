import { describe, it, expect } from "vitest";
import { pickerPosition, PICKER_WIDTH } from "@/lib/scheduled-emails/picker-position";

const view = { width: 1440, height: 900 };

describe("schedule send picker position", () => {
  it("opens below the arrow, right-aligned to it, when there is room", () => {
    expect(pickerPosition({ top: 300, bottom: 344, right: 1000 }, 330, view)).toEqual({ top: 350, left: 1000 - PICKER_WIDTH });
  });

  it("opens upward when the arrow is near the bottom of the window", () => {
    const p = pickerPosition({ top: 760, bottom: 804, right: 1000 }, 330, view);
    expect(p.top).toBe(760 - 6 - 330);
  });

  it("honours placement above when it fits", () => {
    expect(pickerPosition({ top: 500, bottom: 544, right: 1000 }, 330, view, "above").top).toBe(500 - 6 - 330);
  });

  it("stays inside the window on both sides and on a short window", () => {
    expect(pickerPosition({ top: 100, bottom: 140, right: 120 }, 330, view).left).toBe(8);
    expect(pickerPosition({ top: 100, bottom: 140, right: 1600 }, 330, view).left).toBe(1440 - PICKER_WIDTH - 8);
    const short = pickerPosition({ top: 150, bottom: 190, right: 600 }, 330, { width: 800, height: 400 });
    expect(short.top).toBeGreaterThanOrEqual(8);
    expect(short.top + 330).toBeLessThanOrEqual(400 - 8 + 0.001);
  });
});
