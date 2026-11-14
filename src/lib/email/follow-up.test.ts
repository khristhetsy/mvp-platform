import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateMasterAgainstSchema, type PlaceholderSchema } from "./template-schema";
import manifest from "./templates/manifest.json";

const schema = (manifest.masters.find((m) => m.slug === "follow-up")!.schema) as PlaceholderSchema;
const mjml = readFileSync(join(__dirname, "templates/follow-up.mjml"), "utf8");

describe("follow up master", () => {
  it("passes the build guardrails", () => {
    expect(validateMasterAgainstSchema(mjml, schema)).toEqual({ ok: true, errors: [] });
  });

  it("carries the iCFO disclaimer and the unsubscribe link", () => {
    expect(mjml).toContain("does not solicit securities and is not an investment adviser");
    expect(mjml).toContain("{{unsubscribe_url}}");
  });

  it("has no condensed slots, so it never links to the overview page", () => {
    expect(schema.slots.some((s) => s.condense)).toBe(false);
    expect(mjml).not.toContain("overview_url");
  });

  it("has the same fields as the Deal introduction, so the founder prefill fits", () => {
    const di = manifest.masters.find((m) => m.slug === "deal-introduction")!.schema.slots.map((s) => s.key);
    expect(schema.slots.map((s) => s.key)).toEqual(di);
  });
});
