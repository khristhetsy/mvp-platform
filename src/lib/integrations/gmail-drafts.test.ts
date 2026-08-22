import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/integrations/google-access-token", () => ({
  getValidGoogleAccessToken: vi.fn(async () => ({ accessToken: "tok" })),
}));

import {
  parseDraftMessage,
  decodeB64Url,
  draftSummaryFromHeaders,
  createGmailDraft,
  updateGmailDraft,
  deleteGmailDraft,
  hasGmailDraftScope,
  type GmailPart,
} from "./gmail-drafts";
import { buildRawMessage } from "./gmail-send";

const b64url = (s: string) => Buffer.from(s, "utf-8").toString("base64url");

describe("parseDraftMessage — restore fidelity", () => {
  const payload: GmailPart = {
    headers: [
      { name: "To", value: "a@b.com" },
      { name: "Cc", value: "c@d.com" },
      { name: "Bcc", value: "e@f.com" },
      { name: "Subject", value: "Quarterly update" },
    ],
    mimeType: "multipart/mixed",
    parts: [
      {
        mimeType: "multipart/alternative",
        parts: [
          { mimeType: "text/plain", body: { data: b64url("Plain body text") } },
          { mimeType: "text/html", body: { data: b64url("<p>HTML body</p>") } },
        ],
      },
      { mimeType: "application/pdf", filename: "deck.pdf", body: { attachmentId: "att-1", size: 4096 } },
    ],
  };

  it("recovers every field, both bodies, and attachment refs", () => {
    const parsed = parseDraftMessage(payload);
    expect(parsed.to).toBe("a@b.com");
    expect(parsed.cc).toBe("c@d.com");
    expect(parsed.bcc).toBe("e@f.com");
    expect(parsed.subject).toBe("Quarterly update");
    expect(parsed.bodyText).toBe("Plain body text");
    expect(parsed.bodyHtml).toBe("<p>HTML body</p>");
    expect(parsed.attachments).toEqual([
      { name: "deck.pdf", mimeType: "application/pdf", attachmentId: "att-1", size: 4096 },
    ]);
  });

  it("strips the undisclosed-recipients placeholder", () => {
    const parsed = parseDraftMessage({ headers: [{ name: "To", value: "undisclosed-recipients:;" }] });
    expect(parsed.to).toBe("");
  });

  it("decodeB64Url handles empty/undefined", () => {
    expect(decodeB64Url(undefined)).toBe("");
    expect(decodeB64Url(b64url("hi"))).toBe("hi");
  });

  it("draftSummaryFromHeaders reads To + Subject", () => {
    expect(draftSummaryFromHeaders([{ name: "To", value: "x@y.com" }, { name: "Subject", value: "Hey" }]))
      .toEqual({ to: "x@y.com", subject: "Hey" });
  });
});

describe("buildRawMessage — MIME", () => {
  it("encodes headers as base64url and includes attachments as multipart/mixed", () => {
    const raw = buildRawMessage("a@b.com", "Hi", "Hello", null, [
      { name: "f.pdf", mimeType: "application/pdf", content: Buffer.from("PDFDATA") },
    ], "c@d.com", "e@f.com");
    const decoded = Buffer.from(raw, "base64url").toString("utf-8");
    expect(decoded).toContain("To: a@b.com");
    expect(decoded).toContain("Cc: c@d.com");
    expect(decoded).toContain("Bcc: e@f.com");
    expect(decoded).toContain("Subject: Hi");
    expect(decoded).toContain("multipart/mixed");
    expect(decoded).toContain('filename="f.pdf"');
  });
});

describe("hasGmailDraftScope", () => {
  it("accepts modify or compose", () => {
    expect(hasGmailDraftScope(["https://www.googleapis.com/auth/gmail.modify"])).toBe(true);
    expect(hasGmailDraftScope(["https://www.googleapis.com/auth/gmail.compose"])).toBe(true);
    expect(hasGmailDraftScope(["https://www.googleapis.com/auth/gmail.send"])).toBe(false);
  });
});

describe("draft network ops — same id, no duplicates", () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it("createGmailDraft POSTs {message:{raw}} and returns the new id", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ id: "draft-1" }) }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await createGmailDraft("user-1", { to: "a@b.com", subject: "Hi", body: "Yo" });
    expect(res).toEqual({ id: "draft-1" });
    const [url, opts] = fetchMock.mock.calls[0] as unknown as [string, { method: string; body: string }];
    expect(url).toBe("https://gmail.googleapis.com/gmail/v1/users/me/drafts");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body).message.raw).toBeTruthy();
  });

  it("updateGmailDraft PUTs to the SAME draft id (no new draft created)", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ id: "draft-1" }) }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await updateGmailDraft("user-1", "draft-1", { to: "a@b.com", subject: "Hi", body: "Yo v2" });
    expect(res).toEqual({ id: "draft-1" });
    const [url, opts] = fetchMock.mock.calls[0] as unknown as [string, { method: string; body: string }];
    expect(url).toBe("https://gmail.googleapis.com/gmail/v1/users/me/drafts/draft-1");
    expect(opts.method).toBe("PUT");
  });

  it("updateGmailDraft surfaces draft_not_found on 404 (so caller recreates)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404, text: async () => "" })));
    const res = await updateGmailDraft("user-1", "gone", { to: "a@b.com", subject: "Hi", body: "x" });
    expect("error" in res && res.error.message).toBe("draft_not_found");
  });

  it("deleteGmailDraft tolerates a 404 (already gone)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404, text: async () => "" })));
    const res = await deleteGmailDraft("user-1", "gone");
    expect(res).toEqual({ ok: true });
  });
});
