import { describe, expect, it } from "vitest";
import { deleteNoteEntry, editNoteEntry, parseNoteLog } from "./note-log";

const blob = "[2026-09-01] First note\n[2026-10-02] Conference call with John,\nEnhancing Oil Recovery.\n[2026-10-02] Third";

describe("note log", () => {
  it("splits stamped entries and keeps multi-line bodies together", () => {
    const e = parseNoteLog(blob);
    expect(e.map((x) => x.date)).toEqual(["2026-09-01", "2026-10-02", "2026-10-02"]);
    expect(e[1].text).toBe("Conference call with John,\nEnhancing Oil Recovery.");
  });
  it("keeps unstamped leading text as its own entry", () => {
    const e = parseNoteLog("Imported text\n[2026-09-01] A");
    expect(e).toHaveLength(2);
    expect(e[0].date).toBeNull();
    expect(e[0].text).toBe("Imported text");
  });
  it("edits one entry and leaves the rest byte for byte", () => {
    expect(editNoteEntry(blob, 1, "  Call moved  ")).toBe("[2026-09-01] First note\n[2026-10-02] Call moved\n[2026-10-02] Third");
  });
  it("deletes one entry", () => {
    expect(deleteNoteEntry(blob, 0)).toBe("[2026-10-02] Conference call with John,\nEnhancing Oil Recovery.\n[2026-10-02] Third");
    expect(deleteNoteEntry("[2026-09-01] Only", 0)).toBe("");
  });
  it("handles empty input", () => {
    expect(parseNoteLog(null)).toEqual([]);
    expect(parseNoteLog("")).toEqual([]);
  });
});
