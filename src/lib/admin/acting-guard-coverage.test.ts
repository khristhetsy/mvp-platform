import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Guards only protect what they are wired into. These fail when a new founder route that
// changes things, or a billing route, is added without the guard, so the omission is a
// decision someone makes on purpose rather than something nobody noticed.
const ROOT = path.resolve(__dirname, "../../..");

function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...routeFiles(full));
    else if (entry.name === "route.ts") out.push(full);
  }
  return out;
}

const HANDLER = /export async function (POST|PUT|PATCH|DELETE)\((?:[^()]|\([^()]*\))*\)(?:\s*:\s*[^{]+?)?\s*\{\n/g;

function handlers(source: string): Array<{ method: string; firstLines: string }> {
  const found: Array<{ method: string; firstLines: string }> = [];
  for (const m of source.matchAll(HANDLER)) {
    const start = (m.index ?? 0) + m[0].length;
    found.push({ method: m[1], firstLines: source.slice(start, start + 220) });
  }
  return found;
}

describe("social routes refuse changes while staff act as the founder", () => {
  const files = routeFiles(path.join(ROOT, "src/app/api/founder/social"));

  it("finds the social routes", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  for (const file of files) {
    const rel = path.relative(ROOT, file);
    const source = fs.readFileSync(file, "utf8");
    for (const h of handlers(source)) {
      it(`${rel} ${h.method} starts with the acting guard`, () => {
        expect(h.firstLines).toContain("await actingBlock()");
      });
    }
  }

  it("the account connection start (GET) is guarded too", () => {
    const source = fs.readFileSync(path.join(ROOT, "src/app/api/founder/social/connect/route.ts"), "utf8");
    expect(source).toContain("await actingBlock()");
  });
});

describe("outreach, intro and connection routes", () => {
  for (const rel of [
    "src/app/api/founder/outreach/campaigns/route.ts",
    "src/app/api/founder/outreach/campaigns/[id]/route.ts",
    "src/app/api/founder/outreach/targets/[id]/intro/route.ts",
    "src/app/api/integrations/google/disconnect/route.ts",
  ]) {
    it(`${rel} refuses while acting`, () => {
      const source = fs.readFileSync(path.join(ROOT, rel), "utf8");
      expect(handlers(source).length).toBeGreaterThan(0);
      for (const h of handlers(source)) expect(h.firstLines).toContain("await actingBlock()");
    });
  }

  it("manual outreach refuses to start while acting", () => {
    const source = fs.readFileSync(path.join(ROOT, "src/app/api/founder/outreach/manual/route.ts"), "utf8");
    expect(source).toMatch(/body\.action === "start"\)\s*\{\s*const actingBlocked = await actingBlock\(\)/);
  });
});

describe("billing routes are owner only", () => {
  // Public or staff only routes are listed on purpose.
  const EXEMPT = new Set(["webhook", "repair", "debug"]);
  const dir = path.join(ROOT, "src/app/api/billing");
  const files = routeFiles(dir).filter((f) => !EXEMPT.has(path.relative(dir, f).split(path.sep)[0]));

  it("finds the billing routes", () => {
    expect(files.length).toBeGreaterThanOrEqual(5);
  });

  for (const file of files) {
    it(`${path.relative(ROOT, file)} checks billing access`, () => {
      const source = fs.readFileSync(file, "utf8");
      expect(source).toMatch(/billingOwnerOnlyResponse|canManageBilling/);
    });
  }
});

describe("other actions that stay with the Owner while acting", () => {
  for (const rel of [
    "src/app/api/founder/team/route.ts",
    "src/app/api/founder/team/[memberId]/route.ts",
    "src/app/api/account/delete/route.ts",
    "src/app/api/account/restore/route.ts",
    "src/lib/integrations/gmail-send.ts",
  ]) {
    it(`${rel} checks for an acting session`, () => {
      expect(fs.readFileSync(path.join(ROOT, rel), "utf8")).toContain("isActingAsFounder");
    });
  }
});
