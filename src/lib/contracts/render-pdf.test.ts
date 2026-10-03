import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const account = vi.hoisted(() => ({ value: null as null | { scopes: string[] } }));
vi.mock("@/lib/integrations/google-env", () => ({ isGoogleOAuthConfigured: () => true }));
vi.mock("@/lib/integrations/connected-accounts", () => ({
  getGoogleConnectedAccountForUser: async () => (account.value ? { data: account.value } : { error: new Error("not connected") }),
}));
vi.mock("@/lib/integrations/google-access-token", () => ({ getValidGoogleAccessToken: async () => ({ accessToken: "tok" }) }));

import { docxToPdf, renderStatus, RenderFailedError, RenderUnavailableError } from "./render-pdf";
import { DRIVE_FILE_SCOPE } from "@/lib/integrations/google-oauth";

const PDF = Buffer.from("%PDF-1.7 test");
type Call = { url: string; method: string; body?: unknown };

function mockDrive(opts: { upload?: Response; exportRes?: Response } = {}) {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({ url, method: init.method ?? "GET", body: init.body });
    if (url.includes("/upload/drive/v3/files")) return opts.upload ?? new Response(JSON.stringify({ id: "doc1" }), { status: 200 });
    if (url.includes("/export?mimeType=application/pdf")) return opts.exportRes ?? new Response(PDF, { status: 200 });
    if (init.method === "DELETE") return new Response(null, { status: 204 });
    return new Response("unexpected", { status: 500 });
  }));
  return calls;
}

describe("contract PDF render through Google Docs", () => {
  beforeEach(() => {
    account.value = { scopes: ["email", DRIVE_FILE_SCOPE] };
  });
  afterEach(() => vi.unstubAllGlobals());

  it("asks to connect Google when no account is connected", async () => {
    account.value = null;
    expect(await renderStatus("u1")).toEqual({ ready: false, message: expect.stringMatching(/Connect your Google account/) });
    await expect(docxToPdf(Buffer.from("x"), "a.docx", "u1")).rejects.toBeInstanceOf(RenderUnavailableError);
  });

  it("asks to reconnect when the Drive file permission was not granted", async () => {
    account.value = { scopes: ["email"] };
    expect(await renderStatus("u1")).toEqual({ ready: false, message: expect.stringMatching(/Reconnect/) });
  });

  it("uploads as a Google Doc, exports PDF and deletes the Drive copy", async () => {
    const calls = mockDrive();
    const out = await docxToPdf(Buffer.from("DOCX"), "Acme_TermSheet_v1.docx", "u1");
    expect(out.subarray(0, 4).toString()).toBe("%PDF");
    expect(calls.map((c) => c.method)).toEqual(["POST", "GET", "DELETE"]);
    const body = Buffer.from(calls[0].body as Uint8Array).toString();
    expect(body).toContain('"mimeType":"application/vnd.google-apps.document"');
    expect(body).toContain("DOCX");
    expect(calls[2].url).toMatch(/\/files\/doc1$/);
  });

  it("still deletes the Drive copy when the export fails", async () => {
    const calls = mockDrive({ exportRes: new Response(JSON.stringify({ error: { message: "boom" } }), { status: 500 }) });
    await expect(docxToPdf(Buffer.from("DOCX"), "a.docx", "u1")).rejects.toBeInstanceOf(RenderFailedError);
    expect(calls.at(-1)?.method).toBe("DELETE");
  });

  it("names the fix when the Drive API is not enabled", async () => {
    mockDrive({ upload: new Response(JSON.stringify({ error: { message: "Drive API has not been used in project 1", errors: [{ reason: "accessNotConfigured" }] } }), { status: 403 }) });
    await expect(docxToPdf(Buffer.from("DOCX"), "a.docx", "u1")).rejects.toThrow(/Drive API is not enabled/);
  });
});
