/**
 * Shown and Required per screen.
 */
import { describe, it, expect } from "vitest";
import {
  DISPLAY_FIELDS, SKIPPABLE_STEPS, applyDisplayChange, checkDisplayChange, defaultSurface, resolveSurface,
} from "@/lib/profile-fields/display";
import { FIELD_USAGE } from "@/lib/profile-fields/catalog";

const noLocks = {};
const industryLocked = { industry: true };

describe("defaults reproduce each screen before this setting existed", () => {
  it("shows every field", () => {
    for (const sf of ["founder_onboarding", "founder_settings", "admin_editors"] as const) {
      expect(Object.values(defaultSurface(sf)).every((f) => f.shown)).toBe(true);
    }
  });

  it("keeps onboarding's built in requirements", () => {
    const d = defaultSurface("founder_onboarding");
    for (const k of ["industry", "revenue_stage", "funding_amount_band", "seeking_investor_types", "seeking_capital_types", "business_entity", "funding_stage", "operating_stage", "annual_ebitda"]) {
      expect(d[k].required, k).toBe(true);
    }
    for (const k of ["use_of_funds", "annual_revenue_size", "arr", "mrr"]) expect(d[k].required, k).toBe(false);
  });

  it("keeps settings requiring only industry", () => {
    const d = defaultSurface("founder_settings");
    expect(Object.entries(d).filter(([, v]) => v.required).map(([k]) => k)).toEqual(["industry"]);
  });

  it("never requires anything of staff", () => {
    expect(Object.values(resolveSurface({}, "admin_editors", industryLocked)).some((f) => f.required)).toBe(false);
  });
});

describe("locks come from the matching settings", () => {
  it("keeps a field matching requires shown and required, whatever is stored", () => {
    const stored = { founder_onboarding: { industry: { shown: false } } };
    const r = resolveSurface(stored, "founder_onboarding", industryLocked).industry;
    expect(r).toMatchObject({ shown: true, required: true, locked: true });
  });

  it("refuses to hide or relax a locked field", () => {
    expect(checkDisplayChange({ surface: "founder_settings", key: "industry", shown: false, required: false }, industryLocked).ok).toBe(false);
    expect(checkDisplayChange({ surface: "founder_settings", key: "revenue_stage", shown: false, required: false }, noLocks).ok).toBe(true);
  });

  it("follows a newly required matching field", () => {
    const r = resolveSurface({}, "founder_settings", { revenueStage: true }).revenue_stage;
    expect(r.locked && r.required).toBe(true);
  });
});

describe("changes", () => {
  it("refuses a hidden field that is required, and Required on staff screens", () => {
    expect(checkDisplayChange({ surface: "founder_settings", key: "arr", shown: false, required: true }, noLocks).ok).toBe(false);
    expect(checkDisplayChange({ surface: "admin_editors", key: "arr", shown: true, required: true }, noLocks).ok).toBe(false);
  });

  it("refuses a field onboarding does not ask", () => {
    expect(checkDisplayChange({ surface: "founder_onboarding", key: "nope", shown: true, required: false }, noLocks).ok).toBe(false);
  });

  it("stores only differences from the default, so reverting clears the override", () => {
    const hidden = applyDisplayChange({}, { surface: "founder_settings", key: "mrr", shown: false, required: false });
    expect(hidden.founder_settings).toEqual({ mrr: { shown: false } });
    const back = applyDisplayChange(hidden, { surface: "founder_settings", key: "mrr", shown: true, required: false });
    expect(back.founder_settings).toEqual({});
    const req = applyDisplayChange({}, { surface: "founder_onboarding", key: "arr", shown: true, required: true });
    expect(resolveSurface(req, "founder_onboarding", noLocks).arr.required).toBe(true);
  });
});

describe("catalog agreement", () => {
  it("names every display field after a Where used row", () => {
    for (const f of DISPLAY_FIELDS) expect(FIELD_USAGE.some((u) => u.name === f.name), f.name).toBe(true);
  });

  it("skips only steps whose single question is a managed field", () => {
    for (const [step, key] of Object.entries(SKIPPABLE_STEPS)) {
      expect(DISPLAY_FIELDS.find((f) => f.key === key)?.onboardingStep).toBe(Number(step));
    }
  });
});
