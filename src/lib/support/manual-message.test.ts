import { describe, expect, it } from "vitest";
import { newMessageSchema, rewritePrompt, rewriteSchema, signWithFirstName, writePrompt } from "./manual-message";

const ID = "3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b";

describe("newMessageSchema", () => {
  it("accepts a client, subject and message, and emails by default", () => {
    const r = newMessageSchema.parse({ requesterId: ID, subject: " Onboarding call ", body: " Hello " });
    expect(r.subject).toBe("Onboarding call");
    expect(r.body).toBe("Hello");
    expect(r.emailRequester).toBe(true);
  });

  it("rejects a missing subject, an empty message and a bad client id", () => {
    expect(newMessageSchema.safeParse({ requesterId: ID, subject: "  ", body: "x" }).success).toBe(false);
    expect(newMessageSchema.safeParse({ requesterId: ID, subject: "x", body: "  " }).success).toBe(false);
    expect(newMessageSchema.safeParse({ requesterId: "nope", subject: "x", body: "x" }).success).toBe(false);
  });

  it("lets staff turn the email off", () => {
    expect(newMessageSchema.parse({ requesterId: ID, subject: "s", body: "b", emailRequester: false }).emailRequester).toBe(false);
  });
});

describe("rewriteSchema", () => {
  it("accepts a rewrite with a known tone only", () => {
    expect(rewriteSchema.safeParse({ mode: "rewrite", tone: "shorter", base: "Hi" }).success).toBe(true);
    expect(rewriteSchema.safeParse({ mode: "rewrite", tone: "angrier", base: "Hi" }).success).toBe(false);
  });

  it("needs a subject to write a first message, and allows no client yet", () => {
    expect(rewriteSchema.safeParse({ mode: "write", subject: "Onboarding" }).success).toBe(true);
    expect(rewriteSchema.safeParse({ mode: "write", subject: "" }).success).toBe(false);
  });
});

describe("signWithFirstName", () => {
  it("signs with the first name", () => {
    expect(signWithFirstName("Hi Maria.", "Khris Thetsy")).toBe("Hi Maria.\n\nKhris");
  });

  it("does not sign twice", () => {
    expect(signWithFirstName("Hi Maria.\n\nKhris", "Khris Thetsy")).toBe("Hi Maria.\n\nKhris");
  });

  it("leaves the text alone when there is no name", () => {
    expect(signWithFirstName("Hi Maria. ", null)).toBe("Hi Maria.");
    expect(signWithFirstName("Hi Maria.", "  ")).toBe("Hi Maria.");
  });
});

describe("prompts", () => {
  it("keeps every fact when rewriting", () => {
    expect(rewritePrompt("shorter", "Hello there")).toContain("keeping every fact");
    expect(rewritePrompt("friendlier", "Hello there")).toContain("warmer");
  });

  it("only uses the facts it is given when writing", () => {
    const p = writePrompt({ subject: "Onboarding call", requesterName: "Maria", planLabel: null });
    expect(p).toContain("Onboarding call");
    expect(p).toContain("Maria");
    expect(p).toContain("Never invent");
  });
});
