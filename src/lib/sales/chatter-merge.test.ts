import { describe, it, expect } from "vitest";
import { mergeTimeline, parseOdooItemId, groupOf, type NativeRow, type OdooMsg } from "./chatter-merge";
import { noteTextToHtml } from "@/lib/crm-connectors/odoo/notes";

const row = (p: Partial<NativeRow>): NativeRow => ({
  id: "r1", kind: "opp_note", summary: "Native note", created_at: "2026-09-28T17:35:00Z", actor_name: "Khris Thetsy",
  edited_at: null, deleted_at: null, odoo_message_id: null, ...p,
});
const msg = (p: Partial<OdooMsg>): OdooMsg => ({
  id: 1370, date: "2026-09-23T19:33:00Z", author: "Khris Thetsy", subject: null, body: "Conference call with Ken",
  isNote: true, origin: "Odoo opportunity", ...p,
});

describe("mergeTimeline", () => {
  it("merges native rows and Odoo chatter newest first, with groups", () => {
    const out = mergeTimeline(
      [row({}), row({ id: "r2", kind: "stage_changed", summary: "Stage changed", created_at: "2026-09-28T17:37:00Z" })],
      [msg({}), msg({ id: 2, isNote: false, subject: "Hello", body: "Email body", date: "2026-09-24T10:00:00Z" })],
    );
    expect(out.map((i) => i.id)).toEqual(["r2", "r1", "odoo:2", "odoo:1370"]);
    expect(out.map((i) => i.group)).toEqual(["system", "note", "message", "note"]);
    expect(out.find((i) => i.id === "odoo:1370")?.editable).toBe(true);
    expect(out.find((i) => i.id === "odoo:2")?.editable).toBe(false);
    expect(out.find((i) => i.id === "odoo:2")?.summary).toBe("Hello\nEmail body");
  });

  it("shows an Odoo note once, as the iCapOS copy, after it was edited here", () => {
    const edited = row({ id: "a1", kind: "odoo_note", summary: "Edited text", odoo_message_id: 1370, edited_at: "2026-09-28T18:00:00Z", odoo_author: "Jessica Santos", actor_name: "Khris Thetsy" });
    const out = mergeTimeline([edited], [msg({})]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: "a1", summary: "Edited text", source: "odoo", actor_name: "Jessica Santos", edited_at: "2026-09-28T18:00:00Z" });
  });

  it("hides a deleted note and its Odoo copy", () => {
    const gone = row({ id: "a1", kind: "odoo_note", odoo_message_id: 1370, deleted_at: "2026-09-28T18:00:00Z" });
    expect(mergeTimeline([gone], [msg({})])).toHaveLength(0);
  });

  it("does not show a note twice when it was also posted to Odoo", () => {
    const posted = row({ id: "n1", odoo_message_id: 555 });
    const out = mergeTimeline([posted], [msg({ id: 555, body: "Native note" })]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: "n1", source: "icapos", odoo_synced: true });
  });

  it("dedupes the same Odoo message reached from the opportunity and the contact", () => {
    const out = mergeTimeline([], [msg({}), msg({ origin: "Odoo contact" })]);
    expect(out).toHaveLength(1);
  });

  it("skips empty Odoo messages", () => {
    expect(mergeTimeline([], [msg({ body: "", subject: null })])).toHaveLength(0);
  });
});

describe("helpers", () => {
  it("parses odoo item ids", () => {
    expect(parseOdooItemId("odoo:42")).toBe(42);
    expect(parseOdooItemId("0b1c2d3e-0000-0000-0000-000000000000")).toBeNull();
    expect(parseOdooItemId("odoo:abc")).toBeNull();
  });
  it("groups audit rows as system", () => {
    expect(groupOf("note_deleted")).toBe("system");
    expect(groupOf("email")).toBe("message");
  });
  it("escapes note text for Odoo and keeps line breaks", () => {
    expect(noteTextToHtml("Seeking <$1m>\nCap & terms")).toBe("<p>Seeking &lt;$1m&gt;<br>Cap &amp; terms</p>");
  });
});
