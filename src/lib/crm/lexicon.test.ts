import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { describe, it, expect } from "vitest";
import { findForbiddenTerms } from "./lexicon";

// Guardrail: no forbidden terminology (pledge, soft-circle, commitment, SPV, …)
// may appear in operator-facing CRM component copy. This fails the build if it does.

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if ([".tsx", ".ts"].includes(extname(p)) && !p.endsWith(".test.ts")) out.push(p);
  }
  return out;
}

/** Strip code that legitimately contains substrings (imports, the lexicon list itself). */
function visibleCopy(src: string): string {
  return src
    .replace(/^import[^\n]*$/gm, "")
    .replace(/FORBIDDEN_TERMS[\s\S]*?\]/g, "");
}

describe("CRM lexicon guardrail", () => {
  it("has no forbidden terms in components/crm copy", () => {
    const dir = join(process.cwd(), "src", "components", "crm");
    const offenders: Record<string, string[]> = {};
    for (const file of walk(dir)) {
      const found = findForbiddenTerms(visibleCopy(readFileSync(file, "utf8")));
      if (found.length) offenders[file] = found;
    }
    expect(offenders).toEqual({});
  });

  it("detects forbidden terms in a sample string", () => {
    expect(findForbiddenTerms("investor pledge to the SPV")).toEqual(
      expect.arrayContaining(["pledge", "spv"]),
    );
  });
});
