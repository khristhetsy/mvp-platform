import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { buildCoverEmail, buildTestCoverEmail } from "@/lib/contracts/email";

const base = { subject: "Proposal and term sheet for E-Artistry And Company Ltd", body: "Hi Erika,\n\nAttached are the documents.\n\nKhris", senderName: "Khris Thetsy" };

describe("Send test to me", () => {
  it("marks the subject [TEST] and says nothing went to the prospect", () => {
    const m = buildTestCoverEmail({ ...base, backUrl: "https://icapos.com/admin/sales/contracts/send?contact=x", prospectName: "Erika" });
    expect(m.subject).toBe(`[TEST] ${base.subject}`);
    expect(m.text).toContain("nothing was sent to Erika");
    expect(m.html).toContain("https://icapos.com/admin/sales/contracts/send?contact=x");
  });

  it("keeps the same body as the real cover email", () => {
    const real = buildCoverEmail({ ...base, url: "https://icapos.com/contracts/t" });
    const test = buildTestCoverEmail({ ...base, backUrl: "https://icapos.com/x", prospectName: "Erika" });
    expect(test.html).toContain("Attached are the documents.");
    expect(real.html).toContain("Attached are the documents.");
    expect(real.text).not.toContain("[TEST]");
  });

  it("uses the review only wording when there is no signature request", () => {
    const m = buildTestCoverEmail({ ...base, reviewOnly: true, backUrl: "https://icapos.com/x", prospectName: "Erika" });
    expect(m.text).toContain("No signature is requested.");
    expect(m.text).toContain("View documents");
  });
});

import { toICapOSSignature, withDisclaimer, type CoverLook } from "@/lib/contracts/cover-signature";

const ICFO_SIG = '<p><b>KHRIS THETSY</b></p><p><img src="https://ci3.googleusercontent.com/mail-sig/x" width="200"></p><p>iCFO Capital Global, Inc.</p><p><i>"Elevating Your Capital Strategy"</i></p><p>Website: <a href="http://www.icfocapital.com/">www.icfocapital.com</a> | <a href="http://www.icfocapital.com/lajolla">icfo la jolla</a></p>';
const plain = (brand: "icfo" | "icapos"): CoverLook => ({
  brand,
  style: "plain",
  signatureHtml: withDisclaimer(brand === "icapos" ? toICapOSSignature(ICFO_SIG, "https://icapos.com/email-logo.png") : ICFO_SIG),
});

describe("Plain cover email and Send as", () => {
  it("plain style has no header card or button, keeps the body, link and signature", () => {
    const m = buildCoverEmail({ ...base, url: "https://icapos.com/contracts/t", look: plain("icfo") });
    expect(m.html).not.toContain("<table");
    expect(m.html).toContain("Attached are the documents.");
    expect(m.html).toContain('href="https://icapos.com/contracts/t"');
    expect(m.html).toContain("KHRIS THETSY");
    expect(m.html).toContain("iCFO Capital Global, Inc.");
    expect(m.text).toContain("https://icapos.com/contracts/t");
  });

  it("iCapOS swaps the logo, company, tagline and main website, keeps office links", () => {
    const sig = plain("icapos").signatureHtml;
    expect(sig).toContain("email-logo.png");
    expect(sig).not.toContain("mail-sig");
    expect(sig).toContain("<p>iCapOS</p>");
    expect(sig).toContain("The operating system for capital-ready companies");
    expect(sig).toContain('href="https://icapos.com"');
    expect(sig).toContain(">icapos.com<");
    expect(sig).toContain("http://www.icfocapital.com/lajolla");
  });

  it("always carries the iCFO disclaimer", () => {
    expect(plain("icfo").signatureHtml).toContain("solicitation of an offer");
    expect(plain("icapos").signatureHtml).toContain("solicitation of an offer");
  });

  it("plain test copy keeps [TEST] and the test note", () => {
    const m = buildTestCoverEmail({ ...base, backUrl: "https://icapos.com/x", prospectName: "Erika", look: plain("icapos") });
    expect(m.subject).toBe(`[TEST] ${base.subject}`);
    expect(m.text).toContain("nothing was sent to Erika");
  });

  it("branded style uses the chosen company in the card", () => {
    const m = buildCoverEmail({ ...base, url: "https://icapos.com/contracts/t", look: { ...plain("icapos"), style: "branded" } });
    expect(m.html).toContain("sent you these documents from iCapOS");
  });
});
