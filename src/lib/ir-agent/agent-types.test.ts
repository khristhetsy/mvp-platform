import { describe, expect, it } from "vitest";
import { ADMIN_DEFAULT_TYPE, ADMIN_ONLY_TYPES, AGENT_TYPES, AGENT_TYPE_SPECS, DEFAULT_AGENT_TYPE, isAdminOnlyType, isAgentType, templateForType } from "./agent-types";
import { DEFAULT_TEMPLATE } from "./defaults";

describe("agent types", () => {
  it("has a spec and at least one question for every type", () => {
    for (const t of AGENT_TYPES) {
      expect(AGENT_TYPE_SPECS[t].id).toBe(t);
      expect(AGENT_TYPE_SPECS[t].questions.length).toBeGreaterThan(0);
    }
  });

  it("founder uses the master template, the others their own set", () => {
    expect(templateForType("founder", DEFAULT_TEMPLATE).questions).toBe(DEFAULT_TEMPLATE.questions);
    expect(templateForType("sales", DEFAULT_TEMPLATE).questions).toBe(AGENT_TYPE_SPECS.sales.questions);
    expect(templateForType("sales", DEFAULT_TEMPLATE).contactFields).toBe(DEFAULT_TEMPLATE.contactFields);
  });

  it("only sales, marketing and ir are admin only", () => {
    expect([...ADMIN_ONLY_TYPES].sort()).toEqual(["ir", "marketing", "sales"]);
    expect(isAdminOnlyType("founder")).toBe(false);
    expect(isAdminOnlyType("investor")).toBe(false);
    expect(isAdminOnlyType(ADMIN_DEFAULT_TYPE)).toBe(true);
    expect(isAdminOnlyType(DEFAULT_AGENT_TYPE)).toBe(false);
  });

  it("validates type strings", () => {
    expect(isAgentType("sales")).toBe(true);
    expect(isAgentType("admin")).toBe(false);
  });
});
