import { describe, expect, it } from "vitest";
import { acceptanceState, type AcceptanceDoc } from "./acceptance";

const sign = (id: string, status: AcceptanceDoc["status"]): AcceptanceDoc => ({ id, name: `Page ${id}`, partKey: "signature_pages", delivery: "sign", status });
const review = (id: string): AcceptanceDoc => ({ id, name: `Part ${id}`, partKey: "ppm", delivery: "review", status: "shared" });

describe("Manager acceptance", () => {
  it("waits for the subscriber while any signature page is unsigned", () => {
    const s = acceptanceState([sign("a", "signed"), sign("b", "sent"), review("r")], null);
    expect(s.steps[0].detail).toBe("1 of 2 signed");
    expect(s.canAccept).toBe(false);
    expect(s.current).toBe(0);
    expect(s.blocker).toMatch(/not signed every/);
  });

  it("waits for the Manager's countersignature before acceptance opens", () => {
    const s = acceptanceState([sign("a", "signed"), sign("b", "awaiting_countersign")], null);
    expect(s.steps[0].done).toBe(true);
    expect(s.steps[1].done).toBe(false);
    expect(s.canAccept).toBe(false);
    expect(s.blocker).toMatch(/Countersign/);
  });

  it("opens acceptance once every signing page is fully executed, review parts do not count", () => {
    const s = acceptanceState([sign("a", "signed"), sign("b", "signed"), review("r")], null);
    expect(s.canAccept).toBe(true);
    expect(s.current).toBe(2);
    expect(s.blocker).toBeNull();
  });

  it("is done and cannot be accepted twice", () => {
    const s = acceptanceState([sign("a", "signed")], "2026-10-25T10:00:00Z");
    expect(s.canAccept).toBe(false);
    expect(s.current).toBe(-1);
    expect(s.steps[2].done).toBe(true);
  });

  it("a declined or returned page stops acceptance and says why", () => {
    const s = acceptanceState([sign("a", "signed"), sign("b", "declined")], null);
    expect(s.canAccept).toBe(false);
    expect(s.blocker).toMatch(/declined/);
  });

  it("a package with no signing page cannot be accepted", () => {
    expect(acceptanceState([review("r")], null).canAccept).toBe(false);
  });
});
