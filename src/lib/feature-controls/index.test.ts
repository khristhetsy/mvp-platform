import { describe, it, expect } from "vitest";
import {
  FEATURES,
  FEATURE_HREFS,
  FEATURE_AUDIENCES,
  FEATURE_KEY_SET,
  featuresForAudience,
  appliesTo,
  isFeatureEnabled,
  disabledHrefsFor,
  type FeatureFlagMap,
} from "@/lib/feature-controls";

describe("feature-controls registry integrity", () => {
  it("every governed href is disjoint within an audience (no href in two features)", () => {
    for (const audience of FEATURE_AUDIENCES) {
      const seen = new Map<string, string>();
      for (const [key, hrefs] of Object.entries(FEATURE_HREFS[audience])) {
        for (const href of hrefs) {
          expect(seen.has(href), `${href} is in both ${key} and ${seen.get(href)} for ${audience}`).toBe(false);
          seen.set(href, key);
        }
      }
    }
  });

  it("feature keys are unique", () => {
    const keys = FEATURES.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("FEATURE_KEY_SET matches the registry keys", () => {
    for (const f of FEATURES) expect(FEATURE_KEY_SET.has(f.key)).toBe(true);
  });

  it("featuresForAudience only returns features that apply to that audience", () => {
    for (const audience of FEATURE_AUDIENCES) {
      for (const key of featuresForAudience(audience)) {
        expect(appliesTo(audience, key)).toBe(true);
      }
    }
  });
});

describe("feature flag semantics", () => {
  const map: FeatureFlagMap = { "founder:cap_table": false };

  it("defaults to enabled when there is no explicit flag", () => {
    expect(isFeatureEnabled({}, "founder", "business_plan")).toBe(true);
  });

  it("is disabled only when explicitly set to false", () => {
    expect(isFeatureEnabled(map, "founder", "cap_table")).toBe(false);
    expect(isFeatureEnabled(map, "founder", "financial_model")).toBe(true);
  });

  it("hides exactly the disabled feature's hrefs for that audience", () => {
    const hidden = disabledHrefsFor(map, "founder");
    expect(hidden).toContain("/founder/cap-table");
    expect(hidden).not.toContain("/founder/financial-model");
  });

  it("disables nothing for an audience with no flags", () => {
    expect(disabledHrefsFor({}, "investor")).toHaveLength(0);
  });
});
