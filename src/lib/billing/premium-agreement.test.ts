import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import JSZip from "jszip";
import { renderAgreementDocx, renderAgreementCopyEmail } from "./premium-agreement";

const input = {
  companyName: "Acme Robotics, Inc.",
  companyAddress: "1 Main St, Austin, TX 78701",
  companyEmail: "ceo@acme.com",
  acceptedName: "Jane Doe",
  acceptedTitle: "CEO",
};

async function text(buf: Buffer): Promise<string> {
  const z = await JSZip.loadAsync(buf);
  const parts = Object.keys(z.files).filter((n) => /^word\/(document|footer\d*|header\d*)\.xml$/.test(n));
  const xml = await Promise.all(parts.map((n) => z.file(n)!.async("string")));
  return xml.join(" ").replace(/<[^>]+>/g, "");
}

describe("renderAgreementDocx", () => {
  it("fills the founder details and leaves no placeholders or old terms", async () => {
    const t = await text(await renderAgreementDocx(input, "2026-11-12T20:00:00Z"));
    expect(t).toContain("Acme Robotics, Inc.");
    expect(t).toContain("Jane Doe");
    expect(t).toContain("iCFO Capital Global, Inc.");
    expect(t).not.toContain("{{");
    expect(t).not.toContain("5,000");
    expect(t).not.toMatch(/finder/i);
    expect(t).not.toContain("(CITY)");
    expect(t).not.toContain("2022");
  });
});

describe("renderAgreementCopyEmail", () => {
  it("names the company and keeps the body free of the word guarantee", () => {
    const e = renderAgreementCopyEmail({
      firstName: "Jane",
      companyName: "Acme Robotics, Inc.",
      acceptedAt: "2026-11-12T20:00:00Z",
      billingUrl: "https://app.example.com/billing",
    });
    expect(e.subject).toBe("Your iCFO Services Agreement");
    expect(e.text).toContain("Acme Robotics, Inc.");
    expect(e.text).not.toMatch(/guarantee/i);
  });
});
