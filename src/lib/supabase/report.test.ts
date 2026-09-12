import { describe, it, expect, vi, afterEach } from "vitest";
import { reportDbError } from "./report";

afterEach(() => vi.restoreAllMocks());

describe("reportDbError", () => {
  it("returns false and stays silent when there is no error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(reportDbError("ctx", null)).toBe(false);
    expect(reportDbError("ctx", undefined)).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });
  it("returns true and logs with the code and context", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    // 42703 is the code the crm_contacts created_at bug produced for months in silence.
    expect(reportDbError("conversionsByTag", { code: "42703", message: "column does not exist" })).toBe(true);
    expect(spy).toHaveBeenCalledOnce();
    const line = String(spy.mock.calls[0][0]);
    expect(line).toContain("conversionsByTag");
    expect(line).toContain("42703");
  });
  it("copes with an error carrying no code or message", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(reportDbError("ctx", {})).toBe(true);
    expect(String(spy.mock.calls[0][0])).toContain("unknown");
  });
  it("composes as a guard so callers can bail on failure", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const load = (error: { code: string; message: string } | null) =>
      reportDbError("load", error) ? "bailed" : "ok";
    expect(load({ code: "42P01", message: "no table" })).toBe("bailed");
    expect(load(null)).toBe("ok");
  });
});
