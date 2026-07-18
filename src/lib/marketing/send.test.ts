import { describe, it, expect } from "vitest";
import { interpolate, htmlToText, hasOwnBrandLogo } from "./send";

describe("hasOwnBrandLogo — suppress the auto header when a template self-brands", () => {
  it("detects a logo by alt text", () => {
    expect(hasOwnBrandLogo('<img src="https://x.com/a.png" alt="iCapOS" />')).toBe(true);
    expect(hasOwnBrandLogo('<IMG ALT="icapos" SRC="/a.png">')).toBe(true);
  });

  it("detects a logo by src filename", () => {
    expect(hasOwnBrandLogo('<img src="https://icapos.com/email-logo.png" alt="">')).toBe(true);
  });

  it("ignores ordinary content images", () => {
    expect(hasOwnBrandLogo('<img src="https://icapos.com/chart.png" alt="Revenue chart">')).toBe(false);
  });

  it("is false when there is no image at all", () => {
    expect(hasOwnBrandLogo("<p>Hello there</p>")).toBe(false);
  });
});

const vars = { first_name: "Khris", company: "iCFO", email: "k@icfo.com", sender_name: "Jordan" };

describe("interpolate merge fields", () => {
  it("replaces double-brace tokens", () => {
    expect(interpolate("Hi {{first_name}}", vars)).toBe("Hi Khris");
  });

  it("replaces single-brace title-case tokens (the bug that leaked to inboxes)", () => {
    expect(interpolate("Hi {First Name},", vars)).toBe("Hi Khris,");
    expect(interpolate("From {Your Name}", vars)).toBe("From Jordan");
    expect(interpolate("at {Company}", vars)).toBe("at iCFO");
  });

  it("is case- and spacing-insensitive", () => {
    expect(interpolate("{ FIRST_NAME } / {firstName}", vars)).toBe("Khris / Khris");
  });

  it("leaves unknown tokens and CSS braces untouched", () => {
    expect(interpolate("{unknown_token}", vars)).toBe("{unknown_token}");
    expect(interpolate("a { color: red } b", vars)).toBe("a { color: red } b");
  });

  it("substitutes a friendly default when a value is empty", () => {
    expect(interpolate("Hi {first_name}", { first_name: "there" })).toBe("Hi there");
  });
});

describe("htmlToText fallback", () => {
  it("strips tags and preserves basic structure", () => {
    const html = "<style>.x{color:red}</style><p>Hello <b>world</b></p><ul><li>One</li><li>Two</li></ul>";
    const text = htmlToText(html);
    expect(text).toContain("Hello world");
    expect(text).toContain("• One");
    expect(text).not.toContain("<");
    expect(text).not.toContain("color:red");
  });
});
