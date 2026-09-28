import { describe, it, expect } from "vitest";
import { mergeTimeline, type NativeRow } from "./chatter-merge";

const email = (via: string | null): NativeRow => ({
  id: `e-${via}`, kind: "email", summary: "Email sent: Memorandum of terms", created_at: "2026-09-28T18:40:00Z",
  actor_name: "Khris Thetsy", edited_at: null, deleted_at: null, odoo_message_id: null, via,
});

describe("sent email via badge", () => {
  it("carries which mailbox sent the email onto the timeline item", () => {
    const out = mergeTimeline([email("icapos"), email("gmail"), email(null)], []);
    expect(out.map((i) => i.via)).toEqual(["icapos", "gmail", null]);
    expect(out.every((i) => i.group === "message" && !i.editable)).toBe(true);
  });
});
