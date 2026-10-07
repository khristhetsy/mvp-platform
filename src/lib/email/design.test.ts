import { describe, it, expect } from "vitest";
import { designTokens, dominantColor, hasDesign, mapFounderValues, readDesign, suggestLooks, writeDesign } from "./design";
import manifest from "./templates/manifest.json";
import type { PlaceholderSchema } from "./template-schema";

const schemaOf = (slug: string) => manifest.masters.find((m) => m.slug === slug)!.schema as PlaceholderSchema;

describe("which designs carry design settings", () => {
  it("Announcement, Newsletter and Promo do; Deal introduction does not", () => {
    expect(hasDesign(schemaOf("announcement"))).toBe(true);
    expect(hasDesign(schemaOf("newsletter"))).toBe(true);
    expect(hasDesign(schemaOf("promo"))).toBe(true);
    expect(hasDesign(schemaOf("deal-introduction"))).toBe(false);
  });
});

describe("designTokens", () => {
  it("defaults to the classic look (navy banner, white iCFO logo, brand blue)", () => {
    const t = designTokens({}, "Announcement");
    expect(t).toMatchObject({ banner_bg: "#0A1A40", banner_text: "#FFFFFF", banner_align: "left", accent_color: "#1A6CE4", banner_image: "" });
    expect(t.logo_url).toMatch(/icfo-logo-white\.png$/);
  });
  it("Promo is centered by default", () => {
    expect(designTokens({}, "Promo").banner_align).toBe("center");
  });
  it("image banner uses the image; no banner is white with navy text and the color logo", () => {
    const img = designTokens(writeDesign({ banner_image: "https://x.test/b.jpg" }, { banner: "image" }), "Announcement");
    expect(img.banner_image).toBe("https://x.test/b.jpg");
    const none = designTokens(writeDesign({}, { banner: "none", logo: "icapos" }), "Announcement");
    expect(none).toMatchObject({ banner_bg: "#FFFFFF", banner_text: "#0A1A40" });
    expect(none.logo_url).toMatch(/email-logo\.png$/);
  });
  it("ignores unsafe values", () => {
    const t = designTokens({ design_accent: "red;}", design_banner: "image", banner_image: "javascript:x", design_logo: "company", logo_image: "data:x" }, "Announcement");
    expect(t.accent_color).toBe("#1A6CE4");
    expect(t.banner_image).toBe("");
    expect(t.logo_url).toMatch(/icfo-logo-white\.png$/);
  });
  it("uses an uploaded company logo", () => {
    expect(designTokens(writeDesign({ logo_image: "https://cdn.test/logo.png" }, { logo: "company" }), "Announcement").logo_url).toBe("https://cdn.test/logo.png");
  });
});

describe("suggestLooks", () => {
  it("offers classic and minimal without a banner, plus company looks with one", () => {
    const without = suggestLooks({ company: "Acme", hasBanner: false, hasLogo: false, bannerColor: null }).map((l) => l.name);
    expect(without.slice(0, 2)).toEqual(["iCFO classic", "Minimal"]);
    const withBanner = suggestLooks({ company: "Holo MD", hasBanner: true, hasLogo: false, bannerColor: "#7b2ff7" });
    expect(withBanner.slice(0, 4).map((l) => l.name)).toEqual(["iCFO classic", "Company photo", "Company colors", "Minimal"]);
    expect(withBanner[2].design).toMatchObject({ accent: "#7b2ff7", align: "center", banner: "image" });
  });
});

describe("dominantColor", () => {
  it("picks the strong brand color over beige photo tones", () => {
    // Mostly beige and grey photo pixels, a smaller patch of purple (like the Holo MD banner).
    const px: number[] = [];
    for (let i = 0; i < 300; i++) px.push(232, 221, 214, 255);
    for (let i = 0; i < 200; i++) px.push(150, 150, 150, 255);
    for (let i = 0; i < 40; i++) px.push(123, 47, 247, 255);
    expect(dominantColor(px)).toBe("#7b2ff7");
  });
  it("darkens a light pick so white button text stays readable", () => {
    const px: number[] = [];
    for (let i = 0; i < 50; i++) px.push(205, 123, 234, 255); // the lavender the Holo MD banner gives
    const c = dominantColor(px)!;
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    const ch = (v: number) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
    const L = 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
    expect(1.05 / (L + 0.05)).toBeGreaterThanOrEqual(4.5);
    expect(b).toBeGreaterThan(g); // still purple
  });
  it("is null for a grey image", () => {
    expect(dominantColor(new Uint8ClampedArray([128, 128, 128, 255, 200, 200, 200, 255]))).toBeNull();
  });
});

describe("mapFounderValues", () => {
  const v = { headline: "Introducing Holo MD", body: "HoloMD is an early commercialization investment in a provider-linked system. More text.", considerations: "A\nB", terms: "Raise: $2.5M", hero_image: "https://icapos.com/email/deals/holomd-hero.jpg" };
  it("maps onto Newsletter sections", () => {
    expect(mapFounderValues("Newsletter", v)).toMatchObject({ headline: "Introducing Holo MD", intro: v.body, section_one_title: "Highlights", section_one_body: "A\nB", section_two_title: "Terms", section_two_body: "Raise: $2.5M", banner_image: v.hero_image });
  });
  it("Promo subhead is the first sentence, within 120 characters", () => {
    const m = mapFounderValues("Promo", v);
    expect(m.subhead).toBe("HoloMD is an early commercialization investment in a provider-linked system.");
    expect(mapFounderValues("Promo", { body: "x ".repeat(100) }).subhead!.length).toBeLessThanOrEqual(120);
  });
  it("passes the website as the button link fallback", () => {
    expect(mapFounderValues("Announcement", v, "https://holomd.ai/").cta_url_fallback).toBe("https://holomd.ai/");
    expect(mapFounderValues("Deal introduction", v, "https://holomd.ai/").cta_url_fallback).toBe("https://holomd.ai/");
  });
  it("keeps the design settings out of the content", () => {
    expect(readDesign(mapFounderValues("Announcement", v), "Announcement").banner).toBe("brand");
  });
});
