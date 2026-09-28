import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/integrations/signatures", () => ({ decryptIntegrationSecret: vi.fn(), signWebhookPayload: vi.fn() }));

import { buildSlackMessage } from "./webhooks";

const base = {
  event_type: "diligence.document_submitted",
  occurred_at: "2026-09-27T08:12:04Z",
  title: "Diligence document submitted",
  severity: "info",
  entity_type: "diligence_document",
  entity_id: "7f3a91c2-0000",
  company_id: "4be0d8a1-0000",
  metadata: {},
} as never;

describe("buildSlackMessage", () => {
  it("links back to the company and keeps a text fallback", () => {
    const m = buildSlackMessage(base) as { text: string; blocks: Array<Record<string, unknown>> };
    expect(m.text).toBe("Diligence document submitted (Info)");
    const json = JSON.stringify(m.blocks);
    expect(json).toContain("/admin/companies/4be0d8a1-0000");
    expect(json).toContain("Open company in iCapOS");
    expect(json).not.toContain("7f3a91c2");
  });

  it("leads with the company name when the event carries one", () => {
    const m = buildSlackMessage({ ...(base as object), metadata: { company_name: "Northstar & Co <x>" } } as never) as { text: string; blocks: unknown[] };
    expect(m.text).toContain("Northstar & Co <x>: Diligence document submitted");
    expect(JSON.stringify(m.blocks)).toContain("Northstar &amp; Co &lt;x&gt;");
  });

  it("falls back to the admin home without a company", () => {
    const m = buildSlackMessage({ ...(base as object), company_id: null } as never);
    expect(JSON.stringify(m)).toContain('"Open iCapOS"');
  });
});
