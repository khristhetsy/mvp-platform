import { describe, it, expect } from "vitest";
import { buildOwnSignature, resolveDefaultSignature, DEFAULT_ICFO_SIGNATURE } from "./signature";

describe("buildOwnSignature", () => {
  it("uses only the user's own details", () => {
    const html = buildOwnSignature({ fullName: "Jane Founder", email: "jane@acme.com", companyName: "Acme Robotics, Inc.", website: "www.acme.com" });
    expect(html).toContain("Jane Founder");
    expect(html).toContain("Acme Robotics, Inc.");
    expect(html).toContain("mailto:jane@acme.com");
    expect(html).toContain('href="https://www.acme.com/"');
    expect(html).not.toMatch(/khris|icfo/i);
  });

  it("leaves out lines with no data", () => {
    const html = buildOwnSignature({ fullName: "Jane Founder", email: null, companyName: "", website: null });
    expect(html).toContain("Jane Founder");
    expect(html).not.toContain("mailto:");
    expect(html).not.toContain("href=");
  });

  it("returns an empty string when there is nothing to show", () => {
    expect(buildOwnSignature({})).toBe("");
  });

  it("escapes html and drops non http websites", () => {
    const html = buildOwnSignature({ fullName: "<b>x</b>", website: "javascript:alert(1)" });
    expect(html).not.toContain("<b>x</b>");
    expect(html).not.toContain("javascript:");
  });
});

function fakeDb(company: { company_name: string; website: string | null } | null) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    limit: () => chain,
    maybeSingle: async () => ({ data: company }),
  };
  return { from: () => chain } as never;
}

describe("resolveDefaultSignature", () => {
  it("keeps the iCFO signature for the legacy owner only", async () => {
    const owner = await resolveDefaultSignature(fakeDb(null), { id: "1", full_name: "Khris Thetsy", email: "kthetsy@myicfos.com" });
    expect(owner).toBe(DEFAULT_ICFO_SIGNATURE);
    const other = await resolveDefaultSignature(fakeDb(null), { id: "2", full_name: "J F", email: "jf@example.com" });
    expect(other).toContain("J F");
    expect(other).not.toMatch(/khris|thetsy/i);
  });

  it("adds the user's company when one exists", async () => {
    const html = await resolveDefaultSignature(fakeDb({ company_name: "Acme", website: "acme.com" }), { id: "3", full_name: "Jane", email: "jane@acme.com" });
    expect(html).toContain("Acme");
    expect(html).toContain("acme.com");
  });
});
