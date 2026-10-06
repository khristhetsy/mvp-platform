import { beforeEach, describe, expect, it } from "vitest";
import { FakeDb } from "@/lib/verify/fake-db.test-helper";
import { detectFormat, summarize, isLearned, learnFromKnownEmails, formatOrderFor, rankFromPatterns, recordKnownEmail, _clearRankCache, GLOBAL_RANK_MIN_DOMAINS } from "./domain-patterns";

let db: FakeDb;
beforeEach(() => { db = new FakeDb(); _clearRankCache(); });

describe("detectFormat", () => {
  it("names the format a known address uses", () => {
    expect(detectFormat("jane.doe@acme.com", "Jane Doe")).toBe("first.last");
    expect(detectFormat("jdoe@acme.com", "Jane Doe")).toBe("flast");
    expect(detectFormat("jose.alvarez@x.fr", "José Álvarez")).toBe("first.last");
  });
  it("ignores company inboxes and addresses that fit no format", () => {
    expect(detectFormat("info@acme.com", "Jane Doe")).toBeNull();
    expect(detectFormat("jd1987@acme.com", "Jane Doe")).toBeNull();
    expect(detectFormat("jane.doe@acme.com", null)).toBeNull();
  });
});

describe("summarize / isLearned", () => {
  it("picks the majority and counts the rest as conflicts", () => {
    expect(summarize({ "first.last": 3, flast: 1 })).toEqual({ pattern: "first.last", verified: 3, conflicting: 1 });
    expect(summarize({})).toBeNull();
  });
  it("needs 2+ samples and no conflicts", () => {
    expect(isLearned({ verified_samples: 2, conflicting_samples: 0 })).toBe(true);
    expect(isLearned({ verified_samples: 1, conflicting_samples: 0 })).toBe(false);
    expect(isLearned({ verified_samples: 5, conflicting_samples: 1 })).toBe(false);
  });
});

describe("learnFromKnownEmails", () => {
  it("builds per-domain formats from known emails, skipping free and role addresses", async () => {
    db.rows("crm_contacts").push(
      { id: "1", name: "Jane Doe", email: "jane.doe@acme.com", email_source: "given", email_status: "valid" },
      { id: "2", name: "Bob Ray", email: "bob.ray@acme.com", email_source: null, email_status: "unverified" },
      { id: "3", name: "Ann Lee", email: "info@acme.com", email_source: "given", email_status: "valid" },
      { id: "4", name: "Tom Kay", email: "tom.kay@gmail.com", email_source: "given", email_status: "valid" },
      { id: "5", name: "Sam Poe", email: "spoe@other.io", email_source: "given", email_status: "valid" },
    );
    const r = await learnFromKnownEmails(db, 2);
    expect(r).toEqual({ scanned: 5, matched: 3, domains: 2, learned: 1 });
    const acme = db.rows("email_domain_patterns").find((p) => p.domain === "acme.com")!;
    expect(acme).toMatchObject({ pattern: "first.last", verified_samples: 2, conflicting_samples: 0 });
  });
});

describe("recordKnownEmail", () => {
  it("adds a sample and keeps counts per format", async () => {
    await recordKnownEmail(db, "jdoe@acme.com", "Jane Doe");
    await recordKnownEmail(db, "bray@acme.com", "Bob Ray");
    await recordKnownEmail(db, "ann.lee@acme.com", "Ann Lee");
    expect(db.rows("email_domain_patterns")[0]).toMatchObject({ pattern: "flast", verified_samples: 2, conflicting_samples: 1, format_counts: { flast: 2, "first.last": 1 } });
  });
  it("never throws", async () => {
    db.failTables.add("email_domain_patterns");
    await expect(recordKnownEmail(db, "jdoe@acme.com", "Jane Doe")).resolves.toBeUndefined();
  });
});

describe("format order", () => {
  it("keeps the default order until enough domains are learned", () => {
    expect(rankFromPatterns([{ pattern: "flast", verified_samples: 3, conflicting_samples: 0 }])[0]).toBe("first.last");
  });
  it("ranks by how often each format is the learned one", () => {
    const rows = Array.from({ length: GLOBAL_RANK_MIN_DOMAINS }, (_, i) => ({ pattern: i < 15 ? "flast" as const : "first.last" as const, verified_samples: 2, conflicting_samples: 0 }));
    expect(rankFromPatterns(rows).slice(0, 2)).toEqual(["flast", "first.last"]);
  });
  it("a learned domain puts its format first", async () => {
    db.rows("email_domain_patterns").push({ domain: "acme.com", pattern: "f.last", format_counts: {}, verified_samples: 2, conflicting_samples: 0, catch_all: null, last_checked_at: "x" });
    const { order, learned } = await formatOrderFor(db, "acme.com");
    expect(order[0]).toBe("f.last");
    expect(learned?.domain).toBe("acme.com");
    expect(new Set(order).size).toBe(order.length);
  });
});
