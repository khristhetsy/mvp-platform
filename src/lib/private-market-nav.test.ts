import { describe, expect, it } from "vitest";
import { FEATURES } from "@/lib/feature-controls";
import { workspaceNavIconByHref } from "@/lib/ui/nav-icons";

describe("Private Market board menu link", () => {
  it("is governed by the Private Market feature for founders and investors", () => {
    const f = FEATURES.find((x) => x.key === "private_market");
    expect(f?.hrefs.founder).toContain("/private-market");
    expect(f?.hrefs.investor).toContain("/private-market");
  });
  it("has its own icon", () => {
    expect(workspaceNavIconByHref["/private-market"]).toBeDefined();
  });
});
