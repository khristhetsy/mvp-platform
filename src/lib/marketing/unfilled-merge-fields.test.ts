import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { interpolate, sendMarketingEmail, unfilledMergeFields } from "./send";

describe("unfilledMergeFields", () => {
  it("names double-brace fields left as written", () => {
    expect(unfilledMergeFields("{{match_count}} investors fit Ted Stanley")).toEqual(["match_count"]);
    expect(unfilledMergeFields("a {{sector}} b", "c {{stage}} {{sector}}")).toEqual(["sector", "stage"]);
  });
  it("ignores single braces, CSS and plain text", () => {
    expect(unfilledMergeFields("body { color: red } {first_name}", null, "no fields")).toEqual([]);
  });
});

describe("interpolate fills links the sender knows", () => {
  it("fills unsubscribe, preferences and logo links", () => {
    const vars = { unsubscribe_url: "https://icapos.com/unsubscribe?token=t", logo_url: "https://icapos.com/email-logo.png" };
    expect(interpolate('<a href="{{unsubscribe_url}}">x</a> {{preferences_url}} <img src="{{logo_url}}">', vars)).toBe(
      '<a href="https://icapos.com/unsubscribe?token=t">x</a> https://icapos.com/unsubscribe?token=t <img src="https://icapos.com/email-logo.png">',
    );
  });
});

describe("sendMarketingEmail refuses unfilled merge fields", () => {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "re_1" }), { status: 200 }));
  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockClear();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const base = { to: "ted@example.com", first_name: "Ted", company: "Save Our Oceans", from_name: "iCapOS", from_email: "outreach@icapos.com", unsubscribe_token: "t" };

  it("does not send Ted's '{{match_count}} investors fit ...' subject", async () => {
    const r = await sendMarketingEmail({ ...base, subject: "{{match_count}} investors fit {{company}}", html_body: "<p>Hi {{first_name}}</p>" });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("{{match_count}}");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends when the HTML is complete and only the authored text has a stray field (text rebuilt from HTML)", async () => {
    const r = await sendMarketingEmail({
      ...base,
      subject: "Two ways to run it",
      html_body: '<p>Hi {{first_name}}, <a href="https://icapos.com/start">Compare the two</a></p><a href="{{unsubscribe_url}}">Unsubscribe</a>',
      text_body: "Compare the two: {{cta_url}}",
    });
    expect(r.ok).toBe(true);
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body) as { text: string; html: string };
    expect(body.text).not.toContain("{{");
    expect(body.html).not.toContain("{{unsubscribe_url}}");
  });
});

describe("companyForMerge", () => {
  it("reads 'your company' when the company is the person's own name or empty", async () => {
    const { companyForMerge } = await import("./send");
    expect(companyForMerge("Ted Stanley", "Ted", "Stanley")).toBe("your company");
    expect(companyForMerge("ted  stanley", "Ted", "Stanley")).toBe("your company");
    expect(companyForMerge("Anji", "Anji", null)).toBe("your company");
    expect(companyForMerge("", "Ted", "Stanley")).toBe("your company");
    expect(companyForMerge(null)).toBe("your company");
  });
  it("keeps a real company name", async () => {
    const { companyForMerge } = await import("./send");
    expect(companyForMerge("Save Our Oceans Initiative Inc.", "Theodore", "Staley")).toBe("Save Our Oceans Initiative Inc.");
    expect(companyForMerge("RhizeBio", "Dan", "Toal")).toBe("RhizeBio");
  });
});
