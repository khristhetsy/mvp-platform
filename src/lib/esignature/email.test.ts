import { describe, expect, it } from "vitest";
import { buildCompletionEmail, buildSigningInviteEmail } from "./email";

describe("e-signature emails", () => {
  it("invites the signer with a single button and the deal", () => {
    const m = buildSigningInviteEmail({ signerName: "Sam Park", documentName: "Mutual NDA", dealLabel: "Northstar Robotics", signUrl: "https://icapos.com/sign/tok" });
    expect(m.subject).toBe("Review and sign: Mutual NDA");
    expect(m.html).toContain("Hi Sam,");
    expect(m.html).toContain("https://icapos.com/sign/tok");
    expect(m.html).toContain("Northstar Robotics");
    expect(m.text).toContain("Review and sign: https://icapos.com/sign/tok");
  });

  it("works without a signer name or deal", () => {
    const m = buildSigningInviteEmail({ signerName: null, documentName: "NDA", dealLabel: null, signUrl: "https://icapos.com/sign/t" });
    expect(m.html).not.toContain("Hi ,");
    expect(m.html).not.toContain(">Deal<");
  });

  it("sends the completion notice to signer and admin", () => {
    expect(buildCompletionEmail({ documentName: "Mutual NDA", url: "https://icapos.com/api/sign/t/document", forSigner: true }).text).toContain("Your signed copy");
    expect(buildCompletionEmail({ documentName: "Mutual NDA", url: "https://icapos.com/api/sign/t/document", forSigner: false }).text).toContain("has been signed and completed");
  });
});
