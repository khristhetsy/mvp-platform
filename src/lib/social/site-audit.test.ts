import { describe, expect, it } from "vitest";
import { auditHostAllowed, buildFindings, extractFacts, findClaims } from "./site-audit";

const home = `<html><head><title>iCapOS, The Operating System for Capital</title>
<meta name="description" content="Rate your readiness and reach right fit investors."></head>
<body><h1>Raise capital with confidence</h1><h2>For founders and investors</h2>
<a href="/fit">Try the fit check</a><script>var x = "guarantee";</script></body></html>`;

describe("site audit", () => {
  it("extracts title, description, headings and links, ignoring scripts", () => {
    const f = extractFacts(home);
    expect(f.title).toContain("iCapOS");
    expect(f.description).toContain("right fit investors");
    expect(f.headings).toEqual(["Raise capital with confidence", "For founders and investors"]);
    expect(f.links).toContain("/fit");
    expect(f.text).not.toContain("guarantee");
  });

  it("finds claim phrases", () => {
    expect(findClaims("We guarantee a 20% return, risk free")).toEqual(expect.arrayContaining(["guarantee", "risk free", "percent return"]));
    expect(findClaims("Plain helpful copy")).toEqual([]);
  });

  it("builds five findings from readable pages", () => {
    const f = buildFindings([
      { url: "https://icapos.com/", ok: true, html: home },
      { url: "https://icapos.com/fit", ok: true, html: "<html><title>Fit</title><body>Match with investors</body></html>" },
    ]);
    expect(f.map((x) => x.key)).toEqual(["product", "audience", "funnel", "claims", "voice"]);
    expect(f.find((x) => x.key === "funnel")?.status).toBe("found");
    expect(f.find((x) => x.key === "claims")?.status).toBe("found");
  });

  it("flags claims and a missing /fit page", () => {
    const f = buildFindings([{ url: "https://icapos.com/", ok: true, html: "<title>x</title><body>founders, investors, guaranteed returns</body>" }]);
    expect(f.find((x) => x.key === "claims")?.status).toBe("review");
    expect(f.find((x) => x.key === "funnel")?.status).toBe("check");
  });

  it("reports an unreachable site", () => {
    const f = buildFindings([{ url: "https://icapos.com/", ok: false, html: null }]);
    expect(f).toHaveLength(1);
    expect(f[0].status).toBe("check");
  });

  it("only allows icapos.com and the app host", () => {
    expect(auditHostAllowed("icapos.com")).toBe(true);
    expect(auditHostAllowed("www.icapos.com")).toBe(true);
    expect(auditHostAllowed("evil.example")).toBe(false);
    expect(auditHostAllowed("staging.example.com", "https://staging.example.com")).toBe(true);
  });
});
