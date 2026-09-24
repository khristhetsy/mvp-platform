/**
 * The migration, against real Postgres.
 *
 * It seeds nine lists and preserves every label existing records already hold.
 * Getting either wrong empties a picker or orphans an answer, so it is checked
 * here rather than discovered in production.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { CODE_FALLBACK, VOCABULARY_LISTS, resolveSlug } from "@/lib/vocabulary/lists";

const MIGRATION = readFileSync(
  join(process.cwd(), "supabase/migrations/20260923001_vocabulary_options.sql"),
  "utf8",
);
// The revenue lists are split out and seeded here (Profile and fields sections).
const SECTIONS_MIGRATION = readFileSync(
  join(process.cwd(), "supabase/migrations/20260924003_profile_field_sections.sql"),
  "utf8",
);

let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  // The pieces the migration leans on, without dragging in the whole schema.
  await db.exec(`
    create or replace function public.is_staff() returns boolean
      language sql stable as $$ select true $$;
    create or replace function public.touch_updated_at() returns trigger
      language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
    create table if not exists public.profiles (id uuid primary key);
  `);
  await db.exec(MIGRATION);
  await db.exec(SECTIONS_MIGRATION);
});

afterAll(async () => { await db.close(); });

async function rows(list: string) {
  const r = await db.query<{ slug: string; label: string; archived: boolean }>(
    "select slug, label, archived from public.vocabulary_options where list = $1 order by sort_order",
    [list],
  );
  return r.rows;
}

describe("the seed", () => {
  it("fills every list the code knows about", async () => {
    for (const list of VOCABULARY_LISTS) {
      expect((await rows(list)).length, list).toBeGreaterThan(0);
    }
  });

  it("offers the industries that were asked for", async () => {
    const offered = (await rows("industry")).filter((r) => !r.archived).map((r) => r.label);
    expect(offered).toHaveLength(56);
    expect(offered).toContain("Aerospace");
    expect(offered).toContain("Nuclear Waste Recycling");
    expect(offered[offered.length - 1]).toBe("Other");
  });

  // Every label a record can be holding today has to land on some option —
  // offered or archived. A few differ only in case from the new list
  // ("FinTech" / "Fintech"), which is why this checks resolution rather than
  // an exact string: same slug, same match, nothing orphaned.
  it("keeps every label the platform shipped with resolvable, so no record is orphaned", async () => {
    const all = (await rows("industry")).map((r) => ({ ...r, archived: Boolean(r.archived) }));
    for (const o of CODE_FALLBACK.industry) {
      expect(resolveSlug(all, o.label), `${o.label} must still resolve`).not.toBeNull();
    }
  });

  it("resolves a shipped label that differs only in case to the same option", async () => {
    const all = (await rows("industry")).map((r) => ({ ...r, archived: Boolean(r.archived) }));
    expect(resolveSlug(all, "FinTech")).toBe("fintech");
    expect(resolveSlug(all, "CleanTech")).toBe("cleantech");
  });

  it("retires the shipped labels the new list replaces rather than deleting them", async () => {
    const archived = (await rows("industry")).filter((r) => r.archived).map((r) => r.label);
    expect(archived).toContain("SaaS / B2B Software");
    expect(archived).toContain("HealthTech");
    expect(archived).toContain("E-commerce");
    expect(archived).toContain("AI / ML");
  });

  it("does not merge a retired value into a similar new one", async () => {
    // "HealthTech" and "Healthcare" are different rows with different slugs.
    // Deciding they are the same thing is a person's call, not a migration's.
    const all = await rows("industry");
    const healthtech = all.find((r) => r.label === "HealthTech");
    const healthcare = all.find((r) => r.label === "Healthcare");
    expect(healthtech?.slug).toBe("healthtech");
    expect(healthcare?.slug).toBe("healthcare");
    expect(healthtech?.slug).not.toBe(healthcare?.slug);
  });

  it("separates the round from the company — two stage lists, not one", async () => {
    const funding = (await rows("funding_stage")).filter((r) => !r.archived).map((r) => r.label);
    const operating = (await rows("operating_stage")).filter((r) => !r.archived).map((r) => r.label);
    expect(funding).toContain("Series A");
    expect(operating).toContain("Expand Growth");
    expect(operating).not.toContain("Series A");
  });

  it("shares one set of revenue options across the five fields that use them", async () => {
    const bands = (await rows("revenue_band")).filter((r) => !r.archived).map((r) => r.label);
    expect(bands).toEqual(["Pre-revenue", "Under $100k", "$100k – $500k", "$500k – $1M", "$1M – $5M", "$5M+"]);
  });

  it("keeps the old MRR and EBITDA bands resolvable", async () => {
    const archived = (await rows("revenue_band")).filter((r) => r.archived).map((r) => r.label);
    expect(archived).toContain("Under $10k");
    expect(archived).toContain("Negative / pre-profit");
  });

  it("keeps the old capital types resolvable", async () => {
    const all = await rows("capital_type");
    expect(all.find((r) => r.label === "Equity")?.archived).toBe(true);
    expect(all.find((r) => r.label === "Equity Capital")?.archived).toBe(false);
  });

  it("has unique slugs within a list and allows the same slug across lists", async () => {
    const r = await db.query<{ n: number }>(
      "select count(*)::int as n from (select list, slug from public.vocabulary_options group by list, slug having count(*) > 1) d",
    );
    expect(r.rows[0].n).toBe(0);
    const other = await db.query<{ n: number }>(
      "select count(*)::int as n from public.vocabulary_options where slug = 'other'",
    );
    expect(other.rows[0].n).toBeGreaterThan(1);
  });

  it("is safe to run twice", async () => {
    const before = await db.query<{ n: number }>("select count(*)::int as n from public.vocabulary_options");
    await db.exec(MIGRATION);
    const after = await db.query<{ n: number }>("select count(*)::int as n from public.vocabulary_options");
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });

  it("leaves a renamed label alone on a re-run — the table is the source, not the seed", async () => {
    await db.exec("update public.vocabulary_options set label = 'Fin-Tech' where list='industry' and slug='fintech'");
    await db.exec(MIGRATION);
    const r = await rows("industry");
    expect(r.find((x) => x.slug === "fintech")?.label).toBe("Fin-Tech");
    await db.exec("update public.vocabulary_options set label = 'Fintech' where list='industry' and slug='fintech'");
  });
});
