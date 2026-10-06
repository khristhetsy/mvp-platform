import { beforeEach, describe, expect, it } from "vitest";
import { FakeDb } from "./fake-db.test-helper";
import { addMonths, provenancePatch, clearPatch, clearExpired, listExpired, getRetentionMonths, setRetentionMonths, exportContactData } from "./retention";
import { findRates } from "./lookups";

let db: FakeDb;
beforeEach(() => { db = new FakeDb(); });

describe("addMonths", () => {
  it("adds calendar months and clamps month ends", () => {
    expect(addMonths("2026-01-15T00:00:00.000Z", 12)).toBe("2027-01-15T00:00:00.000Z");
    expect(addMonths("2026-01-31T00:00:00.000Z", 1)).toBe("2026-02-28T00:00:00.000Z");
  });
});

describe("provenancePatch", () => {
  const NOW = "2026-10-06T00:00:00.000Z";
  it("starts the clock and records the basis on a fresh contact", () => {
    expect(provenancePatch({ found_at: null, retention_expires_at: null, lawful_basis: null }, 12, "legitimate_interest", NOW))
      .toEqual({ lawful_basis: "legitimate_interest", found_at: NOW, retention_expires_at: "2027-10-06T00:00:00.000Z" });
  });
  it("never moves the clock or overwrites an existing basis", () => {
    expect(provenancePatch({ found_at: "2026-01-01T00:00:00.000Z", retention_expires_at: "2027-01-01T00:00:00.000Z", lawful_basis: "consent" }, 6, "legitimate_interest", NOW)).toEqual({});
  });
  it("fills a missing expiry from the original found date", () => {
    expect(provenancePatch({ found_at: "2026-01-01T00:00:00.000Z", retention_expires_at: null, lawful_basis: "consent" }, 12, "consent", NOW))
      .toEqual({ retention_expires_at: "2027-01-01T00:00:00.000Z" });
  });
});

describe("clearPatch", () => {
  it("clears only finder-sourced values", () => {
    expect(clearPatch({ email_source: "given", phone_source: null })).toEqual({ found_at: null, retention_expires_at: null });
    expect(clearPatch({ email_source: "given", phone_source: "given" })).toEqual({ found_at: null, retention_expires_at: null });
    expect(clearPatch({ email_source: "profile", phone_source: "site" })).toMatchObject({ email: null, email_source: null, phone: null, phone_source: null });
  });
});

describe("clearExpired / listExpired", () => {
  beforeEach(() => {
    db.rows("crm_contacts").push(
      { id: "a", email: "jane@x.com", email_source: "site", phone: "+1", phone_source: "site", retention_expires_at: "2026-01-01T00:00:00.000Z", lead_status: "new", found_at: "2025-01-01" },
      { id: "b", email: "bob@x.com", email_source: "given", phone: "+2", phone_source: "manual_kaspr", retention_expires_at: "2026-01-01T00:00:00.000Z", lead_status: "new", found_at: "2025-01-01" },
      { id: "c", email: "tom@x.com", email_source: "site", phone: null, phone_source: null, retention_expires_at: "2026-01-01T00:00:00.000Z", lead_status: "contacted", found_at: "2025-01-01" },
      { id: "d", email: "amy@x.com", email_source: "site", phone: null, phone_source: null, retention_expires_at: "2099-01-01T00:00:00.000Z", lead_status: "new", found_at: "2025-01-01" },
    );
  });

  it("never clears a contact whose found email went on a send list", async () => {
    db.rows("marketing_contacts").push({ email: "jane@x.com" });
    const r = await clearExpired(db, ["a"], "2026-10-06T00:00:00.000Z");
    expect(r).toEqual({ cleared: 0, skipped: 1 });
    expect(db.rows("crm_contacts")[0]).toMatchObject({ email: "jane@x.com" });
    const list = await listExpired(db, 200, "2026-10-06T00:00:00.000Z");
    expect(list.rows.map((x) => x.id)).toEqual(["b", "c"]);
  });

  it("clears approved expired rows and keeps given emails", async () => {
    const r = await clearExpired(db, ["a", "b", "d"], "2026-10-06T00:00:00.000Z");
    expect(r).toEqual({ cleared: 2, skipped: 1 });
    const [a, b, , d] = db.rows("crm_contacts");
    expect(a).toMatchObject({ email: null, phone: null, found_at: null });
    expect(b).toMatchObject({ email: "bob@x.com", phone: null });
    expect(d).toMatchObject({ email: "amy@x.com" });
  });

  it("lists expired rows (contacted filtering happens in the query)", async () => {
    const r = await listExpired(db, 200, "2026-10-06T00:00:00.000Z");
    expect(r.rows.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
});

describe("retention setting", () => {
  it("defaults to 12 and validates", async () => {
    expect(await getRetentionMonths(db)).toBe(12);
    await setRetentionMonths(db, 6);
    expect(await getRetentionMonths(db)).toBe(6);
    await expect(setRetentionMonths(db, 0)).rejects.toThrow();
  });
});

describe("exportContactData", () => {
  it("still exports before the v2 migration", async () => {
    db.failColumns.add("found_at");
    db.rows("crm_contacts").push({ id: "a", name: "Jane" });
    expect(await exportContactData(db, "a")).toMatchObject({ contact: { id: "a" } });
  });

  it("returns the contact with its lookup and suggestion history", async () => {
    db.rows("crm_contacts").push({ id: "a", name: "Jane" });
    db.rows("contact_lookups").push({ contact_id: "a", source: "site", field: "email", outcome: "found" });
    const r = await exportContactData(db, "a");
    expect(r).toMatchObject({ contact: { id: "a" }, lookup_history: [{ source: "site" }], suggestions: [] });
    expect(await exportContactData(db, "zz")).toBeNull();
  });
});

describe("findRates", () => {
  it("is found / (found + not found); skips and errors don't count", () => {
    const r = findRates([
      { source: "site", outcome: "found" }, { source: "site", outcome: "not_found" }, { source: "site", outcome: "not_found" },
      { source: "site", outcome: "skipped_suppressed" }, { source: "pattern", outcome: "error" },
    ]);
    expect(r).toEqual([{ source: "site", label: "Company website", found: 1, notFound: 2, attempts: 3, rate: 1 / 3 }]);
  });
});
