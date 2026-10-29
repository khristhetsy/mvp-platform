import { beforeEach, describe, expect, it, vi } from "vitest";

type Result = { data?: unknown; error: { code?: string; message: string } | null };
const inserts: unknown[] = [];
let insertResults: Result[] = [];

const afterCalls: Array<() => unknown> = [];
vi.mock("next/server", () => ({ after: (fn: () => unknown) => { afterCalls.push(fn); } }));

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

import type { OdooMsg } from "@/lib/sales/chatter-merge";
import {
  bookingConfirmationLog, buildPreview, campaignLogInputs, logCampaignSends, queueCampaignNotesLog, chipFilter, chipFor, chipOf, stepOf, formatPT, groupCounts, logCommunication, logCommunicationBatch,
  mergeOdooEntries, oneYearBefore, pickMeta, rowToEntry, tagOf, toInsertRow, type CommunicationInput,
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

describe("mergeOdooEntries", () => {
  const cutoff = new Date("2025-10-29T00:00:00Z");
  const msg = (id: number, over: Partial<OdooMsg> = {}): OdooMsg => ({
    id, date: "2026-10-01T10:00:00Z", author: "Odoo User", subject: null, body: `Body ${id}`, isNote: true, origin: "Odoo contact", ...over,
  });

  it("shows every unmirrored Odoo message, once, with its origin", () => {
    const { entries, extra } = mergeOdooEntries([msg(1), msg(1), msg(2, { isNote: false, subject: "Re: deck" })], [], "c1", cutoff);
    expect(entries.map((e) => e.id)).toEqual(["odoo:1", "odoo:2"]);
    expect(entries[0]).toMatchObject({ kind: "odoo_note", chip: "notes", source: "odoo", origin: "Odoo contact", editable: true, tag: null });
    expect(entries[1]).toMatchObject({ kind: "odoo_message", chip: "messages", editable: false, summary: "Re: deck\nBody 2" });
    expect(extra.recent).toMatchObject({ all: 2, notes: 1, messages: 1 });
  });

  it("shows a mirrored message as its iCapOS row (de-duplicated by odoo_message_id)", () => {
    const mirror = { id: "row-1", kind: "odoo_note", summary: "Edited here", created_at: "2026-10-01T10:00:00Z", odoo_message_id: 1, contact_crm_id: "c1", deleted_at: null, meta: { odoo_author: "Odoo User" } };
    const { entries, extra } = mergeOdooEntries([msg(1)], [mirror], "c1", cutoff);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ id: "row-1", summary: "Edited here", actor_name: "Odoo User", source: "odoo" });
    // Already in the contact's own row counts.
    expect(extra.recent.all).toBe(0);
  });

  it("counts a mirror row filed on another contact", () => {
    const mirror = { id: "row-2", kind: "odoo_note", summary: "x", created_at: "2026-10-01T10:00:00Z", odoo_message_id: 1, contact_crm_id: null, deleted_at: null };
    expect(mergeOdooEntries([msg(1)], [mirror], "c1", cutoff).extra.recent.all).toBe(1);
  });

  it("keeps a message hidden when its mirror row was deleted here, as the current Note Log does", () => {
    const mirror = { id: "row-3", kind: "odoo_note", summary: "x", created_at: "2026-10-01T10:00:00Z", odoo_message_id: 1, contact_crm_id: "c1", deleted_at: "2026-10-20T00:00:00Z" };
    expect(mergeOdooEntries([msg(1)], [mirror], "c1", cutoff).entries).toEqual([]);
  });

  it("files an undated or old message under older than 1 year, never drops it", () => {
    const { entries, extra } = mergeOdooEntries([msg(5, { date: null })], [], "c1", cutoff);
    expect(entries).toHaveLength(1);
    expect(extra.older.all).toBe(1);
  });

  it("skips empty messages, as the current Note Log does", () => {
    expect(mergeOdooEntries([msg(6, { body: "", subject: null })], [], "c1", cutoff).entries).toEqual([]);
  });
});

describe("sequence emails under the Sequences chip", () => {
  const oldRow = { id: "s-old", kind: "email", summary: "Sequence email sent: Hi", created_at: "2026-10-01T10:00:00Z",
    meta: { via: "icapos", sequence: { name: "Founders", step: 2 }, email: { to: "a@x.com", subject: "Hi", body: "full body" } } };
  const newRow = { ...oldRow, id: "s-new", meta: { ...oldRow.meta, step: 3, sequence_id: "seq-1", to: "a@x.com", subject: "Hi", preview: "full body", external_id: "re_1" } };

  it("reads the step from meta.step, or meta.sequence.step on older rows", () => {
    expect(stepOf(newRow.meta)).toBe(3);
    expect(stepOf(oldRow.meta)).toBe(2);
    expect(stepOf({ via: "gmail" })).toBeNull();
    expect(stepOf(null)).toBeNull();
  });

  it("files an email with a step under Sequences, a plain email under Email", () => {
    expect(chipFor("email", 2)).toBe("sequences");
    expect(chipFor("email", null)).toBe("email");
    expect(chipFor("sequence", null)).toBe("sequences");
    expect(chipFor("note", 4)).toBe("notes");
  });

  it("shows old and new sequence rows as Sequences entries with the step number", () => {
    expect(rowToEntry(oldRow)).toMatchObject({ chip: "sequences", tag: "auto", meta: { step: 2 } });
    expect(rowToEntry(newRow)).toMatchObject({ chip: "sequences", meta: { step: 3, sequence_id: "seq-1", external_id: "re_1" } });
  });

  it("counts them under Sequences, not Email", () => {
    const c = groupCounts([
      { kind: "email", created_at: "2026-10-01T00:00:00Z", step: 2 },
      { kind: "email", created_at: "2026-10-02T00:00:00Z", step: null },
    ], new Date("2025-10-29T00:00:00Z"));
    expect(c.recent).toMatchObject({ all: 2, email: 1, sequences: 1 });
  });

  it("filters the query the same way", () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const q: Record<string, (...a: unknown[]) => unknown> = {};
    for (const m of ["eq", "is", "or", "in"]) q[m] = (...a: unknown[]) => { calls.push([m, ...a]); return q; };
    chipFilter(q, "email");
    expect(calls).toEqual([["eq", "kind", "email"], ["is", "meta->>step", null], ["is", "meta->sequence->>step", null]]);
    calls.length = 0;
    chipFilter(q, "sequences");
    expect(calls).toEqual([["or", "kind.eq.sequence,and(kind.eq.email,meta->>step.not.is.null),and(kind.eq.email,meta->sequence->>step.not.is.null)"]]);
    calls.length = 0;
    chipFilter(q, "calls");
    expect(calls).toEqual([["in", "kind", ["call"]]]);
  });
});

describe("campaignLogInputs", () => {
  const campaign = { id: "camp-1", name: "October update", subject: "Our October update" };

  it("writes one marketing row per sent email per matching CRM contact, at the real send time", () => {
    const rows = campaignLogInputs(campaign, [
      { email: "Ana@Example.com", resend_id: "re_1", occurred_at: "2026-10-01T15:00:00Z" },
      { email: "nobody@example.com", resend_id: "re_2", occurred_at: "2026-10-01T15:00:01Z" },
    ], new Map([["ana@example.com", ["c1", "c2"]]]));
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.contactCrmId)).toEqual(["c1", "c2"]);
    expect(rows[0]).toMatchObject({
      kind: "marketing", summary: "Campaign email sent: Our October update", occurredAt: "2026-10-01T15:00:00Z",
      meta: { direction: "outbound", to: "Ana@Example.com", campaign_id: "camp-1", campaign_name: "October update", external_id: "re_1" },
    });
  });

  it("falls back to campaign and address as the external id when Resend gave none", () => {
    const rows = campaignLogInputs(campaign, [{ email: "ana@example.com", resend_id: null, occurred_at: null }], new Map([["ana@example.com", ["c1"]]]));
    expect(rows[0].meta?.external_id).toBe("camp-1:ana@example.com");
  });

  it("logs nothing for recipients that are not admin CRM contacts", () => {
    expect(campaignLogInputs(campaign, [{ email: "founder@x.com", resend_id: "re_9", occurred_at: null }], new Map())).toEqual([]);
  });
});

describe("campaign Notes log never touches or delays a send", () => {
  it("queues the log with next/server after() and returns at once", () => {
    afterCalls.length = 0;
    expect(queueCampaignNotesLog({ id: "camp-1", name: "n", subject: "s" })).toBeUndefined();
    expect(afterCalls).toHaveLength(1);
  });

  it("never throws when the database read fails, and reports to the server log", async () => {
    // The test client has no select(): the read throws inside logCampaignSends.
    await expect(logCampaignSends({ id: "camp-1", name: "n", subject: "s" })).resolves.toBeNull();
    expect(console.error).toHaveBeenCalled();
  });
});

describe("bookingConfirmationLog", () => {
  const base = { contactCrmId: "c1", hostId: "h1", bookingId: "b1", bookerEmail: "ana@x.com", title: "Intro call" };
  const investorMatches = { total: 12, matches: [{ company: "Acme Ventures", fit: 82, detail: "Seed · Fintech" }, { company: "Beta Capital", fit: 77, detail: "x" }] };

  it("logs the booker's confirmation as an email, safe to write twice", () => {
    expect(bookingConfirmationLog({ ...base, hostCopySent: true })).toMatchObject({
      kind: "email", summary: "Booking confirmation sent: Intro call", contactCrmId: "c1", actorId: "h1",
      meta: { via: "icapos", direction: "outbound", to: "ana@x.com", subject: "Confirmed: Intro call", external_id: "booking-confirmation:b1" },
    });
  });

  it("records the investor matches only when the host copy carrying them was sent", () => {
    expect(bookingConfirmationLog({ ...base, investorMatches, hostCopySent: true }).meta?.investor_matches)
      .toEqual({ total: 12, matches: [{ company: "Acme Ventures", fit: 82 }, { company: "Beta Capital", fit: 77 }] });
    expect(bookingConfirmationLog({ ...base, investorMatches, hostCopySent: false }).meta?.investor_matches).toBeUndefined();
    expect(bookingConfirmationLog({ ...base, investorMatches: null, hostCopySent: true }).meta?.investor_matches).toBeUndefined();
  });

  it("keeps the matches through the row builder and the reader", () => {
    const row = toInsertRow(bookingConfirmationLog({ ...base, investorMatches, hostCopySent: true }));
    expect(row.meta?.investor_matches?.matches).toHaveLength(2);
    expect(rowToEntry({ id: "r", kind: "email", summary: "x", created_at: "2026-10-29T09:41:00Z", meta: row.meta }).meta.investor_matches?.total).toBe(12);
  });
});
