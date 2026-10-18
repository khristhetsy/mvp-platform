import { describe, expect, it } from "vitest";
import {
  capturePath,
  findPrivateSpans,
  isDemoAccountEmail,
  normalizeForHash,
  rowUpdateAfterCapture,
} from "../../../../scripts/lib/coach-screenshots-core.mjs";
import { isInternalAccount } from "@/lib/notifications/internal-accounts";

describe("demo account guard", () => {
  it("allows only @myicfos.com addresses", () => {
    expect(isDemoAccountEmail("demo@myicfos.com")).toBe(true);
    expect(isDemoAccountEmail("  Demo@MyICFOs.com ")).toBe(true);
    expect(isDemoAccountEmail("founder@acme.com")).toBe(false);
    expect(isDemoAccountEmail("x@myicfos.com.evil.io")).toBe(false);
    expect(isDemoAccountEmail("")).toBe(false);
    expect(isDemoAccountEmail(null)).toBe(false);
  });
  it("agrees with the platform's internal account rule for founder accounts", () => {
    for (const email of ["a@myicfos.com", "b@gmail.com", "c@myicfos.co", null, ""]) {
      expect(isDemoAccountEmail(email), String(email)).toBe(isInternalAccount({ email, role: "founder" }));
    }
  });
});

describe("private data", () => {
  const kinds = (text: string) => findPrivateSpans(text).map((s) => s.kind);
  it("finds emails, phone numbers and amounts", () => {
    expect(kinds("Write to jane@acme.com or call (415) 555-0134, ask for $1,200,000")).toEqual(["email", "phone", "amount"]);
    expect(kinds("Raise €2.5M and +1 415-555-0134")).toEqual(["phone", "amount"].reverse());
  });
  it("leaves dates and plain numbers alone", () => {
    expect(kinds("Scored 2026-10-18, step 3 of 15, 62 points")).toEqual([]);
  });
});

describe("screen fingerprint", () => {
  it("ignores private values and numbers but notices changed text", () => {
    const a = normalizeForHash("Outreach  Manual\nSent 3 days ago to jane@acme.com for $1,000");
    const b = normalizeForHash("Outreach Manual\nSent 4 days ago to sam@other.com for $2,500");
    expect(a).toBe(b);
    expect(normalizeForHash("Outreach Manual Start campaign")).not.toBe(normalizeForHash("Outreach Manual"));
  });
});

describe("storage path and row update", () => {
  it("versions each capture by time", () => {
    expect(capturePath({ courseSlug: "c", lessonId: "l", stepIndex: 2, capturedAt: "2026-10-18T10:00:00.000Z" })).toBe("c/l/2/2026-10-18T10-00-00-000Z.png");
  });
  it("a failure records the error and keeps the previous image", () => {
    const u = rowUpdateAfterCapture({ ok: false, error: "Control not found" });
    expect(u).toEqual({ capture_error: "Control not found", capture_requested_at: null });
    expect(u).not.toHaveProperty("image_path");
  });
  it("a success clears the error and the request", () => {
    const u = rowUpdateAfterCapture({ ok: true, imagePath: "p", contentHash: "h", capturedAt: "t", appVersion: "v", pinned: true });
    expect(u).toMatchObject({ image_path: "p", content_hash: "h", app_version: "v", pinned: true, capture_error: null, capture_requested_at: null });
  });
});
