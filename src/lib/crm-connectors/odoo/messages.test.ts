import { describe, it, expect, vi, beforeEach } from "vitest";

// The classifier lives inside fetchPartnerMessages (mapping raw mail.message rows to
// OdooContactMessage). We drive it by mocking the Odoo client's executeKw so the map
// runs on controlled rows, then assert isNote is true ONLY for the Note subtype.
const executeKw = vi.fn();
vi.mock("./client", () => ({
  odooConfigured: () => true,
  executeKw: (...args: unknown[]) => executeKw(...args),
}));

import { fetchPartnerMessages } from "./messages";

beforeEach(() => executeKw.mockReset());

describe("fetchPartnerMessages — note vs message classification", () => {
  it("treats only the Note subtype as an internal note", async () => {
    executeKw.mockResolvedValue([
      { id: 1, date: "2026-08-29 12:43:00", subject: false, body: "<p>Real message</p>", message_type: "notification", author_id: [5, "Jessica Santos"], subtype_id: [2, "Discussions"] },
      { id: 2, date: "2026-08-28 09:00:00", subject: false, body: "<p>Internal jotting</p>", message_type: "comment", author_id: [5, "Jessica Santos"], subtype_id: [1, "Note"] },
      { id: 3, date: "2026-08-27 09:00:00", subject: false, body: "<p>Sent email</p>", message_type: "email", author_id: [5, "Khris Thetsy"], subtype_id: false },
      { id: 4, date: "2026-08-26 09:00:00", subject: false, body: "<p>Discussion</p>", message_type: "comment", author_id: [5, "Khris Thetsy"], subtype_id: [2, "Discussions"] },
    ]);

    const rows = await fetchPartnerMessages("184293", 80);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));

    // Integration-posted message (notification + Discussions) is NOT a note.
    expect(byId[1].isNote).toBe(false);
    // Note subtype IS a note.
    expect(byId[2].isNote).toBe(true);
    // Plain sent email (no subtype) is NOT a note.
    expect(byId[3].isNote).toBe(false);
    // Discussions is NOT a note.
    expect(byId[4].isNote).toBe(false);
  });

  it("strips HTML and normalizes Odoo UTC datetimes to ISO", async () => {
    executeKw.mockResolvedValue([
      { id: 9, date: "2026-08-29 12:43:00", subject: "Hi", body: "<p>Line one</p><p>Line two</p>", message_type: "comment", author_id: [5, "Jessica Santos"], subtype_id: [2, "Discussions"] },
    ]);
    const [row] = await fetchPartnerMessages("184293", 80);
    expect(row.date).toBe("2026-08-29T12:43:00Z");
    expect(row.body).toBe("Line one\nLine two");
    expect(row.author).toBe("Jessica Santos");
  });

  it("returns [] for a non-numeric external id", async () => {
    const rows = await fetchPartnerMessages("formd-firm:abc", 80);
    expect(rows).toEqual([]);
    expect(executeKw).not.toHaveBeenCalled();
  });

  it("falls back to the partner's message_ids when the record search is empty", async () => {
    executeKw
      // 1) mail.message search_read on the record → empty
      .mockResolvedValueOnce([])
      // 2) res.partner read message_ids
      .mockResolvedValueOnce([{ message_ids: [11, 12] }])
      // 3) mail.message read those ids
      .mockResolvedValueOnce([
        { id: 12, date: "2026-08-29 12:43:00", subject: false, body: "<p>Fallback message</p>", message_type: "notification", author_id: [5, "Jessica Santos"], subtype_id: [2, "Discussions"] },
        { id: 11, date: "2026-08-28 09:00:00", subject: false, body: "<p>Older note</p>", message_type: "comment", author_id: [5, "Jessica Santos"], subtype_id: [1, "Note"] },
      ]);

    const rows = await fetchPartnerMessages("184293", 80);
    expect(rows.map((r) => r.id)).toEqual([12, 11]); // newest first
    expect(rows[0].isNote).toBe(false);
    expect(rows[1].isNote).toBe(true);
    expect(rows[0].body).toBe("Fallback message");
  });
});
