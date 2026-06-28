import { describe, it, expect } from "vitest";
import { computeDataRoomState } from "@/lib/data-room/completeness";
import type { DocumentRecord } from "@/lib/supabase/types";

function doc(type: string, status = "uploaded"): DocumentRecord {
  return { document_type: type, status, file_name: `${type}.pdf`, created_at: "2026-01-01" } as unknown as DocumentRecord;
}

const CORE = [doc("PITCH_DECK"), doc("FINANCIAL_STATEMENTS"), doc("CAP_TABLE")];

describe("data-room completeness", () => {
  it("is empty/0% with no documents and has 9 required items", () => {
    const s = computeDataRoomState([]);
    expect(s.total).toBe(9);
    expect(s.completed).toBe(0);
    expect(s.percent).toBe(0);
    expect(s.coreTotal).toBe(3);
    expect(s.coreComplete).toBe(false);
  });

  it("marks core complete when pitch deck + financials (alias) + cap table are in", () => {
    const s = computeDataRoomState(CORE);
    expect(s.coreComplete).toBe(true);
    expect(s.completed).toBe(3);
    expect(s.percent).toBe(33);
  });

  it("counts needs_review as completed but flags it", () => {
    const s = computeDataRoomState([doc("PITCH_DECK", "needs_review")]);
    expect(s.completed).toBe(1);
    expect(s.needsReviewCount).toBe(1);
  });

  it("prioritises a missing core doc as the next item", () => {
    expect(computeDataRoomState([]).nextItem?.core).toBe(true);
    expect(computeDataRoomState(CORE).nextItem?.core).toBe(false);
  });

  it("routes generatable docs to their in-app tool and others to upload", () => {
    const items = computeDataRoomState([]).items;
    const bp = items.find((i) => i.label === "Business plan");
    const team = items.find((i) => i.label === "Team bios");
    expect(bp?.path).toBe("generate");
    expect(bp?.href).toBe("/founder/business-plan");
    expect(team?.path).toBe("upload");
    expect(team?.href).toBe("/founder/documents");
  });

  it("reaches 100% / fullComplete with all nine required types", () => {
    const all = ["Pitch deck", "Financial model", "Cap table", "Business plan", "Team bios", "Legal documents", "Corporate documents", "Customer contracts", "Market research"]
      .map((l) => doc(l.toUpperCase().replaceAll(" ", "_")));
    const s = computeDataRoomState(all);
    expect(s.percent).toBe(100);
    expect(s.fullComplete).toBe(true);
    expect(s.coreComplete).toBe(true);
  });
});
