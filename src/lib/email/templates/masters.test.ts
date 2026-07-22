import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MASTER_DESCRIPTORS } from "./masters";
import { validateMasterAgainstSchema } from "../template-schema";

// Verifies every seeded .mjml against its schema using the same validator the
// build:emails guardrail uses. Catches an authoring mistake (missing footer,
// unknown token, required slot never referenced) without needing mjml to compile.

const TPL_DIR = join(process.cwd(), "src/lib/email/templates");

describe("seeded MJML masters", () => {
  it("ships exactly the three masters from the spec", () => {
    expect(MASTER_DESCRIPTORS.map((m) => m.slug).sort()).toEqual(["announcement", "newsletter", "promo"]);
  });

  for (const master of MASTER_DESCRIPTORS) {
    it(`${master.name}: every token maps to a slot/locked/send token and the footer is present`, () => {
      const mjml = readFileSync(join(TPL_DIR, `${master.slug}.mjml`), "utf8");
      const result = validateMasterAgainstSchema(mjml, master.schema);
      // Surface the actual errors if this ever fails.
      expect(result.errors).toEqual([]);
      expect(result.ok).toBe(true);
    });

    it(`${master.name}: carries the mandatory unsubscribe link`, () => {
      const mjml = readFileSync(join(TPL_DIR, `${master.slug}.mjml`), "utf8");
      expect(mjml).toContain("{{unsubscribe_url}}");
    });
  }
});
