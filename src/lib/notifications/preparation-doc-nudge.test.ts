import { describe, it, expect } from "vitest";
import { buildPreparationDocNudge, preparationDocStatus } from "@/lib/notifications/preparation-doc-nudge";

const deck = { document_type: "PITCH_DECK", created_at: "2026-09-12T10:00:00Z" };

describe("Ready to Match document nudge", () => {
  it("names the missing documents and what is done", () => {
    const n = buildPreparationDocNudge({ firstName: "Maya", companyName: "Northfield Labs", uploads: [deck] })!;
    expect(n.title).toBe("2 documents left before investor matching");
    expect(n.subject).toBe("2 documents left before investor matching, Northfield Labs");
    expect(n.message).toBe("Add your financial statements and cap table. Your pitch deck is in.");
    expect(n.text).toContain("You have 1 of the 3 required documents in. Add the other 2");
    expect(n.text).toContain("Done: Pitch deck");
    expect(n.text).toContain("Missing: Cap table");
    expect(n.html).toContain("Uploaded Sep 12");
    expect(n.html).toContain("/founder/cap-table");
    expect(n.html).toContain("/founder/financial-model");
    expect(n.html).not.toContain("/founder/pitch-deck\"");
  });

  it("handles a founder with nothing uploaded", () => {
    const n = buildPreparationDocNudge({ firstName: null, companyName: null, uploads: [] })!;
    expect(n.title).toBe("3 documents left before investor matching");
    expect(n.subject).toBe("3 documents left before investor matching");
    expect(n.message).toBe("Add your pitch deck, financial statements and cap table. Start with the one you have.");
    expect(n.text).toContain("Hi there,");
  });

  it("uses singular copy for one missing document", () => {
    const n = buildPreparationDocNudge({
      firstName: "Ana",
      companyName: "Acme",
      uploads: [deck, { document_type: "financials", created_at: null }],
    })!;
    expect(n.title).toBe("1 document left before investor matching");
    expect(n.message).toBe("Add your cap table. Your pitch deck and financial statements are in.");
  });

  it("returns null when every required document is in", () => {
    const all = [deck, { document_type: "FINANCIAL_STATEMENTS", created_at: null }, { document_type: "cap_table", created_at: null }];
    expect(buildPreparationDocNudge({ firstName: "A", companyName: "B", uploads: all })).toBeNull();
    expect(preparationDocStatus(all).every((s) => s.done)).toBe(true);
  });

  it("escapes names in the email", () => {
    const n = buildPreparationDocNudge({ firstName: "<b>x</b>", companyName: "A & B", uploads: [] })!;
    expect(n.html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(n.html).toContain("A &amp; B");
  });
});
