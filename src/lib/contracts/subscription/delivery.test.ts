import { describe, expect, it } from "vitest";
import { isReviewDoc, type Bundle } from "../service";

const bundle = (over: { delivery?: "sign" | "review"; source?: "template" | "upload"; request?: string | null }): Bundle =>
  ({
    doc: { source: over.source ?? "template", signature_request_id: over.request ?? null },
    template: { delivery: over.delivery ?? "sign" },
    fields: [],
    entity: null,
    contact: { id: "c", name: "n", email: null, company: null, tags: [], address: null },
  }) as unknown as Bundle;

describe("which documents in a packet are signed", () => {
  it("a master marked review is only read", () => {
    expect(isReviewDoc(bundle({ delivery: "review" }))).toBe(true);
  });
  it("a master marked sign is signed", () => {
    expect(isReviewDoc(bundle({ delivery: "sign" }))).toBe(false);
  });
  it("an uploaded PDF with signature boxes placed is signed (existing contracts are unchanged)", () => {
    expect(isReviewDoc(bundle({ source: "upload", request: "r1" }))).toBe(false);
  });
  it("an uploaded PDF with no signing request, like an IRS form, is only read", () => {
    expect(isReviewDoc(bundle({ source: "upload", request: null }))).toBe(true);
  });
});
