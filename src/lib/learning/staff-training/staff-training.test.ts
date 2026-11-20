import { describe, expect, it } from "vitest";
import { checkInvite, generateInviteToken, hashInviteToken, inviteExpiry, inviteLink } from "./invites";
import { getTrainingModule, modulesForAudience, readyModuleCount, STAFF_TRAINING_MODULES } from "./catalog";
import { buildAskPrompt, buildFeedbackPrompt } from "./coach";

const future = () => new Date(Date.now() + 86_400_000).toISOString();

describe("invites", () => {
  it("hashes deterministically and tokens are unique", () => {
    const a = generateInviteToken();
    expect(a).not.toBe(generateInviteToken());
    expect(hashInviteToken(a)).toBe(hashInviteToken(a));
    expect(hashInviteToken(a)).not.toContain(a);
  });
  it("accepts a valid invite for the invited email, case insensitive", () => {
    expect(checkInvite({ status: "invited", expires_at: future(), email: "A@x.com" }, "a@X.com").ok).toBe(true);
  });
  it("refuses revoked, used, expired and wrong account", () => {
    const base = { expires_at: future(), email: "a@x.com" };
    expect(checkInvite({ ...base, status: "revoked" }, "a@x.com")).toEqual({ ok: false, reason: "revoked" });
    expect(checkInvite({ ...base, status: "accepted" }, "a@x.com")).toEqual({ ok: false, reason: "used" });
    expect(checkInvite({ ...base, status: "invited", expires_at: new Date(Date.now() - 1000).toISOString() }, "a@x.com")).toEqual({ ok: false, reason: "expired" });
    expect(checkInvite({ ...base, status: "invited" }, "b@x.com")).toEqual({ ok: false, reason: "wrong_account" });
    expect(checkInvite({ ...base, status: "invited" }, null)).toEqual({ ok: false, reason: "wrong_account" });
  });
  it("expires in 7 days and builds a link", () => {
    const d = new Date("2026-11-20T00:00:00Z");
    expect(inviteExpiry(d).toISOString()).toBe("2026-11-27T00:00:00.000Z");
    expect(inviteLink("https://x.com/", "t k")).toBe("https://x.com/learn/staff-training/accept?token=t%20k");
  });
});

describe("catalog", () => {
  it("lists 29 modules with unique keys and three ready", () => {
    expect(STAFF_TRAINING_MODULES).toHaveLength(29);
    expect(new Set(STAFF_TRAINING_MODULES.map((m) => m.key)).size).toBe(29);
    expect(readyModuleCount()).toBe(3);
  });
  it("licensee sessions are hidden from staff and the reverse", () => {
    expect(modulesForAudience("staff").some((m) => m.audience === "licensee")).toBe(false);
    expect(modulesForAudience("licensee").every((m) => m.audience !== "staff")).toBe(true);
  });
  it("ready modules have steps and exercises", () => {
    for (const m of STAFF_TRAINING_MODULES.filter((x) => x.status === "ready")) {
      expect(m.steps?.length).toBeGreaterThan(0);
      expect(m.exercises?.length).toBeGreaterThan(0);
    }
    expect(getTrainingModule("nope")).toBeNull();
  });
});

describe("coach prompts", () => {
  const mod = getTrainingModule("support-queue")!;
  it("grounds the coach in the lesson and forbids promises", () => {
    const p = buildAskPrompt({ module: mod, tone: "driven" }, "How do I close?");
    expect(p.system).toContain("Never promise refunds");
    expect(p.system).toContain("Close out the ticket");
  });
  it("leaves Pass or Redo to the reviewer", () => {
    const p = buildFeedbackPrompt({ module: mod, tone: "relentless" }, mod.exercises![0], "my answer");
    expect(p.system).toContain("human reviewer decides");
  });
});
