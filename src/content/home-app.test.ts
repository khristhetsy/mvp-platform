import { describe, expect, it } from "vitest";
import { home } from "@/content/home";

// The homepage states that iCapOS does not make introductions, so the app copy must not promise them.
describe("home.app copy", () => {
  const text = JSON.stringify(home.app).toLowerCase();

  it("makes no introduction or funding promises", () => {
    expect(text).not.toContain("introduc");
    expect(text).not.toContain("guaranteed");
  });

  it("carries the platform disclaimer and links to the install page", () => {
    expect(home.app.compliance).toBe(home.hero.compliance);
    expect(home.app.installLink.href).toBe("/install");
  });

  it("uses the current product name only", () => {
    expect(text).not.toContain("capital" + "os");
  });
});

import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/marketing-site/app-links";

describe("store links", () => {
  it("are either unset or real https store URLs", () => {
    if (PLAY_STORE_URL) expect(PLAY_STORE_URL).toMatch(/^https:\/\/play\.google\.com\/store\/apps\/details\?id=com\.icapos\.app$/);
    if (APP_STORE_URL) expect(APP_STORE_URL).toMatch(/^https:\/\/apps\.apple\.com\//);
  });
});
