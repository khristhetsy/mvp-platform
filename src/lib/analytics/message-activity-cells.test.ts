import { describe, expect, it } from "vitest";
import { heatLevel, receivedCell, sentCell } from "./message-activity-cells";
import type { ReceivedItem, SentItem } from "./message-activity-metrics";

const rec = (source: string, title: string, status = "unread", channel: ReceivedItem["channel"] = "in_app"): ReceivedItem => ({
  id: source + title + status, at: "2026-10-06T16:00:00Z", personKey: "p", channel, title, message: null, source, status, link: null, emailId: null,
});
const sent = (investor: string, status = "sent"): SentItem => ({
  id: investor + status, at: "2026-10-06T16:00:00Z", personKey: "p", kind: "preview", investor, investorEmail: null,
  status, title: "", emailId: null, detail: null, handledAt: null,
});

describe("heat shading", () => {
  it("scales by the column's busiest row", () => {
    expect(heatLevel(0, 9, 4)).toBe(0);
    expect(heatLevel(1, 9, 4)).toBe(1);
    expect(heatLevel(5, 9, 4)).toBe(3);
    expect(heatLevel(9, 9, 4)).toBe(4);
    expect(heatLevel(2, 8, 3)).toBe(1);
    expect(heatLevel(4, 8, 3)).toBe(2);
    expect(heatLevel(7, 8, 3)).toBe(3);
  });
});

describe("received cells", () => {
  it("counts each kind when there are several", () => {
    const items = [
      ...Array.from({ length: 7 }, (_, i) => rec("orchestration_overdue", `Overdue ${i}`)),
      rec("orchestration_inactivity", "Quiet", "read"),
    ];
    expect(receivedCell(items)).toMatchObject({ count: 8, status: "1 read", detail: "Overdue 7 · Inactivity 1" });
  });

  it("shows the latest title when there is one kind, and email statuses", () => {
    const c = receivedCell([rec("founder_match_digest", "25 investors match", "sent", "email")]);
    expect(c).toMatchObject({ count: 1, status: "sent", detail: "25 investors match" });
  });
});

describe("sent cells", () => {
  it("names the first investor, the rest as a count, and the queue", () => {
    const c = sentCell([sent("Luis Sanz"), sent("Ana Ruiz"), sent("Bo Li", "skipped")], { queued: 27 });
    expect(c.status).toBe("2 sent · 1 skipped · 27 queued");
    expect(sentCell([sent("Luis Sanz")], { queued: 27 }).status).toBe("sent · 27 queued");
    expect(c.detail).toBe("Luis Sanz +2");
  });

  it("shows the plan allowance when nothing went out", () => {
    expect(sentCell([], { allowance: { cap: 5, used: 5, resetsAt: "2026-11-01T18:00:00Z" } }).detail).toBe("Full until 1 Nov");
    expect(sentCell([], { allowance: { cap: 5, used: 2, resetsAt: "2026-11-01T18:00:00Z" } }).detail).toBe("3 of 5 left");
  });
});
