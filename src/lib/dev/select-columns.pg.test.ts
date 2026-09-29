/**
 * Every column the code selects must exist.
 *
 * `contact-page-data.ts` selected `companies.readiness_score` — a column that
 * has never existed on that table. It type-checked, linted and tested clean,
 * because every Supabase call goes through an `any` cast; PostgREST rejected
 * the whole select at runtime, the error was discarded, and the linked-company
 * panel quietly rendered as "no company" for months.
 *
 * This is the feedback loop that was missing: the migrations are applied to a
 * real Postgres, the source is scanned for `.from(...).select(...)`, and any
 * column that isn't in the schema fails the build.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { buildMigrationSchema, type MigrationSchema } from "@/lib/dev/migration-schema";
import { scanSelects, type SelectUse } from "@/lib/dev/select-scan";

/**
 * Columns PostgREST understands that aren't real columns, and embedded
 * resources named after a foreign key rather than a column.
 */
const NOT_COLUMNS = new Set(["count", "sum", "avg", "min", "max"]);

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) { sourceFiles(full, out); continue; }
    if (/\.(ts|tsx)$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

let schema: MigrationSchema;
let uses: (SelectUse & { file: string })[];

beforeAll(async () => {
  schema = await buildMigrationSchema();
  uses = sourceFiles("src").flatMap((file) =>
    scanSelects(readFileSync(file, "utf8")).map((u) => ({ ...u, file })),
  );
}, 180_000);

describe("the schema this guard checks against", () => {
  it("applies almost every migration — a mostly-empty schema would pass anything", () => {
    expect(schema.applied / schema.total).toBeGreaterThan(0.95);
  });

  it("has the tables the app reads most", () => {
    for (const t of ["companies", "crm_contacts", "profiles", "events", "event_presenters"]) {
      expect(schema.columns.has(t), t).toBe(true);
    }
  });

  it("does not contain the column that caused this", () => {
    // If `companies.readiness_score` ever legitimately exists, delete this test
    // rather than working around it.
    expect(schema.columns.get("companies")?.has("readiness_score")).toBe(false);
  });
});

describe("the scanner finds real calls", () => {
  it("picks up a plain select", () => {
    expect(scanSelects(`db.from("companies").select("id, company_name")`)).toEqual([
      { table: "companies", column: "id", line: 1 },
      { table: "companies", column: "company_name", line: 1 },
    ]);
  });

  it("follows a select split across concatenated strings", () => {
    const found = scanSelects(`db.from("companies").select("id, slug," +\n  " arr, mrr")`);
    expect(found.map((f) => f.column)).toEqual(["id", "slug", "arr", "mrr"]);
  });

  it("ignores the columns of an embedded resource — they belong to another table", () => {
    const found = scanSelects(`db.from("event_presenters").select("*, events:event_id(title, slug)")`);
    expect(found.map((f) => f.column)).toEqual([]);
  });

  it("resolves an alias to the column behind it", () => {
    expect(scanSelects(`db.from("companies").select("name:company_name")`)[0].column).toBe("company_name");
  });

  it("skips a select it cannot read statically, rather than guessing", () => {
    expect(scanSelects("db.from(\"companies\").select(cols)")).toEqual([]);
    expect(scanSelects("db.from(\"companies\").select(`id, ${extra}`)")).toEqual([]);
  });

  it("does not attribute one chain's select to another chain's table", () => {
    const found = scanSelects(`db.from("a").update(x);\ndb.from("companies").select("id")`);
    expect(found).toEqual([{ table: "companies", column: "id", line: 2 }]);
  });

  it("finds a useful number of real calls in this codebase", () => {
    expect(uses.length).toBeGreaterThan(200);
  });
});

describe("every selected column exists", () => {
  it("names each one that does not", () => {
    const bad = uses.filter(
      (u) =>
        schema.columns.has(u.table) &&
        !NOT_COLUMNS.has(u.column) &&
        !schema.columns.get(u.table)?.has(u.column),
    );

    const report = bad
      .map((u) => `${u.file}:${u.line} — ${u.table}.${u.column} does not exist`)
      .sort();

    expect(report, `\n${report.join("\n")}\n`).toEqual([]);
  });

  it("reports which tables it could not check", () => {
    // Not a failure: a table whose migration won't run under PGlite simply
    // isn't covered. Kept visible so the gap can't grow unnoticed.
    const unchecked = [...new Set(uses.filter((u) => !schema.columns.has(u.table)).map((u) => u.table))];
    expect(unchecked.length, `unchecked tables: ${unchecked.join(", ")}`).toBeLessThan(40);
  });
});
