import { describe, expect, it } from "vitest";
import { makeTestimonialToken, testimonialUrl, verifyTestimonialToken } from "./token";
import { makeUnsubscribeToken, verifyUnsubscribeToken } from "@/lib/marketing/send";

describe("testimonial token", () => {
  it("round-trips a normalized email", () => {
    expect(verifyTestimonialToken(makeTestimonialToken(" Alan@Brainiest.ai "))).toBe("alan@brainiest.ai");
  });
  it("rejects tampered, missing or foreign tokens", () => {
    const t = makeTestimonialToken("a@b.co");
    const [enc] = t.split(".");
    const forged = `${Buffer.from("x@b.co").toString("base64url")}.${t.split(".")[1]}`;
    expect(verifyTestimonialToken(forged)).toBeNull();
    expect(verifyTestimonialToken(`${enc}.deadbeef`)).toBeNull();
    expect(verifyTestimonialToken(undefined)).toBeNull();
    expect(verifyTestimonialToken("garbage")).toBeNull();
  });
  it("is not interchangeable with the unsubscribe token", () => {
    expect(verifyTestimonialToken(makeUnsubscribeToken("a@b.co"))).toBeNull();
    expect(verifyUnsubscribeToken(makeTestimonialToken("a@b.co"))).toBeNull();
  });
  it("builds the page URL", () => {
    expect(testimonialUrl("a@b.co", "https://icapos.com")).toMatch(/^https:\/\/icapos\.com\/testimonial\?t=[\w-]+\.[0-9a-f]{32}$/);
  });
});
