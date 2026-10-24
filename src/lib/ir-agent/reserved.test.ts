import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RESERVED_SLUGS } from "./slug";

const ROOT = join(__dirname, "..", "..", "..");

/** Every path segment under src/app that a founder's company slug could collide with. */
function topLevelNames(dir: string, dirsOnly = false): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true })
    .filter((e) => !dirsOnly || e.isDirectory())
    .map((e) => e.name.replace(/\.(tsx?|svg|ico|png|jpg|html)$/, ""))
    .filter((n) => !/^[[(_]/.test(n));
}

describe("reserved company slugs", () => {
  it("cover every top level route, so /[company]/[ending] never shadows one", () => {
    const names = new Set([...topLevelNames("src/app"), ...topLevelNames("src/app/(marketing)"), ...topLevelNames("public", true)]);
    const ignore = new Set(["layout", "page", "loading", "error", "global-error", "not-found", "globals", "sw", "favicon"]);
    const missing = [...names].filter((n) => !ignore.has(n) && !RESERVED_SLUGS.has(n.toLowerCase()) && !n.includes("."));
    expect(missing).toEqual([]);
  });

  it("matches the list seeded by the migrations", () => {
    const seeded = new Set<string>();
    for (const file of ["20261013120000_ir_agents.sql", "20261013190000_ir_agents_studio.sql", "20261024140000_ir_agent_reserved_slug_clients.sql"]) {
      const sql = readFileSync(join(ROOT, "supabase/migrations", file), "utf8");
      const start = sql.indexOf("insert into public.ir_agent_reserved_slugs");
      const block = sql.slice(start, sql.indexOf("on conflict (slug) do nothing", start));
      for (const m of block.match(/\('([a-z0-9.-]+)'\)/g) ?? []) seeded.add(m.slice(2, -2));
    }
    expect([...seeded].sort()).toEqual([...RESERVED_SLUGS].sort());
  });
});
