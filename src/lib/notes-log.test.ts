import { beforeEach, describe, expect, it, vi } from "vitest";

type Result = { data?: unknown; error: { code?: string; message: string } | null };
const inserts: unknown[] = [];
let insertResults: Result[] = [];

vi.mock("@/lib/supabase/admin", () => ({
  createServiceRoleClient: () => ({
    from: () => ({
      insert: async (row: unknown) => {
        inserts.push(row);
        return insertResults.shift() ?? { error: null };
      },
    }),
  }),
}));

import {
  buildPreview, chipOf, formatPT, groupCounts, logCommunication, logCommunicationBatch,
  oneYearBefore, pickMeta, rowToEntry, tagOf, toInsertRow, type CommunicationInput,
} from "./notes-log";

beforeEach(() => {
  inserts.length = 0;
  insertResults = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("formatPT", () => {
  it("always shows the year and PT", () => {
    expect(formatPT("2026-10-29T09:41:00Z")).toBe("Oct 29, 2026, 2:41 AM PT");
  });
  it("uses standard time in winter", () => {
    expect(formatPT(new Date("2027-01-15T20:05:00Z"))).toBe("Jan 15, 2027, 12:05 PM PT");
  });
  it("returns empty for a bad date", () => {
    expect(formatPT("nope")).toBe("");
  });
});

describe("buildPreview", () => {
  it("strips HTML, styles and entities into one line", () => {
    const html = "<style>p{color:red}</style><p>Hi&nbsp;Ana,</p><p>Our deck &amp; data room<br/>are ready &#8212; take a look.</p>";
    expect(buildPreview(html)).toBe("Hi Ana, Our deck & data room are ready — take a look.");
  });
  it("cuts at 280 characters", () => {
    const out = buildPreview("word ".repeat(100));
    expect(out.length).toBeLessThanOrEqual(280);
    expect(out.endsWith(" ")).toBe(false);
  });
  it("handles empty input", () => {
    expect(buildPreview(null)).toBe("");
    expect(buildPreview("")).toBe("");
  });
});

describe("chips and tags", () => {
  it("maps kinds to chips, system kinds to none", () => {
    expect(chipOf("note")).toBe("notes");
    expect(chipOf("opp_note")).toBe("notes");
    expect(chipOf("email")).toBe("email");
    expect(chipOf("message")).toBe("messages");
    expect(chipOf("call")).toBe("calls");
    expect(chipOf("sequence")).toBe("sequences");
    expect(chipOf("marketing")).toBe("marketing");
    expect(chipOf("contact_edit")).toBeNull();
    expect(chipOf("stage_changed")).toBeNull();
  });
  it("tags marketing, inbound and auto; notes and system kinds have none", () => {
    expect(tagOf("marketing", {})).toBe("marketing");
    expect(tagOf("email", { direction: "inbound" })).toBe("inbound");
    expect(tagOf("call", { direction: "inbound" })).toBe("inbound");
    expect(tagOf("email", { via: "gmail" })).toBe("auto");
    expect(tagOf("sequence", null)).toBe("auto");
    expect(tagOf("note", null)).toBeNull();
    expect(tagOf("task_created", null)).toBeNull();
  });
});

describe("pickMeta", () => {
  it("keeps known keys, drops unknown and empty ones, coerces numbers", () => {
    expect(pickMeta({ via: "gmail", subject: "", foo: 1, step: "3", duration_seconds: "42" }))
      .toEqual({ via: "gmail", step: 3, duration_seconds: 42 });
  });
  it("reads the older call rows' duration", () => {
    expect(pickMeta({ outcome: "answered", duration: 65 })).toEqual({ outcome: "answered", duration_seconds: 65 });
  });
  it("handles null", () => {
    expect(pickMeta(null)).toEqual({});
  });
});

describe("toInsertRow", () => {
  it("builds the row with the real time and a cut preview", () => {
    const row = toInsertRow({
      kind: "marketing", summary: "  Campaign sent: October update  ", contactCrmId: "c1",
      occurredAt: "2026-10-01T15:00:00Z",
      meta: { campaign_name: "October update", preview: `<p>${"x".repeat(400)}</p>`, external_id: "log-1" },
    });
    expect(row).toMatchObject({
      kind: "marketing", summary: "Campaign sent: October update", contact_crm_id: "c1",
      opportunity_id: null, actor_id: null, created_at: "2026-10-01T15:00:00.000Z",
    });
    expect(row.meta?.preview).toHaveLength(280);
    expect(row.meta?.external_id).toBe("log-1");
  });
  it("leaves created_at to the database when no time is given", () => {
    expect(toInsertRow({ kind: "email", summary: "Email sent", contactCrmId: "c1" })).not.toHaveProperty("created_at");
    expect(toInsertRow({ kind: "email", summary: "Email sent", contactCrmId: "c1" }).meta).toBeNull();
  });
});

describe("logCommunication", () => {
  const input: CommunicationInput = { kind: "email", summary: "Email sent: Hi", contactCrmId: "c1", meta: { via: "gmail", external_id: "g-1" } };

  it("inserts one row", async () => {
    expect(await logCommunication(input)).toBe("logged");
    expect(inserts).toHaveLength(1);
  });
  it("treats a unique violation as already logged", async () => {
    insertResults = [{ error: { code: "23505", message: "duplicate key" } }];
    expect(await logCommunication(input)).toBe("duplicate");
    expect(console.error).not.toHaveBeenCalled();
  });
  it("never throws: other errors go to the server log", async () => {
    insertResults = [{ error: { code: "42501", message: "denied" } }];
    expect(await logCommunication(input)).toBe("failed");
    expect(console.error).toHaveBeenCalled();
  });
  it("skips a row with no contact", async () => {
    expect(await logCommunication({ ...input, contactCrmId: "" })).toBe("failed");
    expect(inserts).toHaveLength(0);
  });
});

describe("logCommunicationBatch", () => {
  const make = (n: number): CommunicationInput[] =>
    Array.from({ length: n }, (_, i) => ({ kind: "marketing", summary: "Campaign sent", contactCrmId: `c${i}`, meta: { external_id: `e${i}` } }));

  it("inserts in batches of 500", async () => {
    const out = await logCommunicationBatch(make(1100));
    expect(out).toEqual({ logged: 1100, duplicate: 0, failed: 0 });
    expect((inserts as unknown[][]).map((b) => b.length)).toEqual([500, 500, 100]);
  });
  it("retries a batch with an already logged row one by one", async () => {
    insertResults = [{ error: { code: "23505", message: "duplicate key" } }, { error: null }, { error: { code: "23505", message: "dup" } }, { error: null }];
    const out = await logCommunicationBatch(make(3));
    expect(out).toEqual({ logged: 2, duplicate: 1, failed: 0 });
  });
});

describe("groupCounts", () => {
  it("splits counts at the 12 month cutoff, system kinds only in all", () => {
    const now = new Date("2027-08-01T00:00:00Z");
    const cutoff = oneYearBefore(now);
    expect(cutoff.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    const counts = groupCounts([
      { kind: "email", created_at: "2027-07-01T00:00:00Z" },
      { kind: "note", created_at: "2027-07-02T00:00:00Z" },
      { kind: "contact_edit", created_at: "2027-07-03T00:00:00Z" },
      { kind: "marketing", created_at: "2026-07-01T00:00:00Z" },
    ], cutoff);
    expect(counts.recent).toEqual({ all: 3, notes: 1, email: 1, messages: 0, calls: 0, sequences: 0, marketing: 0 });
    expect(counts.older).toEqual({ all: 1, notes: 0, email: 0, messages: 0, calls: 0, sequences: 0, marketing: 1 });
  });
});

describe("rowToEntry", () => {
  it("shapes a row for the timeline: tag, PT time, only notes editable", () => {
    const e = rowToEntry({
      id: "r1", kind: "call", summary: "Call: Answered", created_at: "2026-10-29T09:41:00Z", edited_at: null,
      meta: { direction: "outbound", phone: "+14155550100", duration_seconds: 120, outcome: "answered", recording_url: "https://rec.example/1" },
      actor: { full_name: "Khris", email: null },
    });
    expect(e).toMatchObject({ chip: "calls", tag: "auto", editable: false, actor_name: "Khris", created_at_pt: "Oct 29, 2026, 2:41 AM PT" });
    expect(e.meta.recording_url).toBe("https://rec.example/1");
    expect(rowToEntry({ id: "n1", kind: "note", summary: "x", created_at: "2026-10-29T09:41:00Z" }).editable).toBe(true);
  });
  it("drops unsafe links", () => {
    const e = rowToEntry({ id: "r", kind: "email", summary: "x", created_at: "2026-10-29T09:41:00Z", meta: { href: "https://evil.example", recording_url: "javascript:alert(1)" } });
    expect(e.meta.href).toBeUndefined();
    expect(e.meta.recording_url).toBeUndefined();
  });
});
