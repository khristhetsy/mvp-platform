/**
 * Every menu item must lead somewhere.
 *
 * "Networking Matching" was added to the sidebar one commit before the page it
 * pointed at existed, so the live menu had an item that 404'd. Nothing caught
 * it: a nav href is a string, and no type, lint rule or test ever compared it
 * against the routes the app can serve.
 *
 * This does. It fails the build on a link to a page that isn't there.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { collectRoutes, routeExists, scanNavHrefs } from "@/lib/dev/route-map";

const routes = collectRoutes("src/app");
const navSource = readFileSync("src/lib/workspace-nav.ts", "utf8");
const navHrefs = scanNavHrefs(navSource);

describe("the route map is real", () => {
  it("found the app's routes", () => {
    expect(routes.length).toBeGreaterThan(100);
  });

  it("includes a static route, a dynamic one and a nested one", () => {
    expect(routes).toContain("/admin/events");
    expect(routes.some((r) => r.includes("[") )).toBe(true);
    expect(routes).toContain("/admin/events/registrations");
  });
});

describe("matching an href against the map", () => {
  const map = ["/admin/events", "/admin/events/[id]/control", "/events/[slug]", "/docs/[...path]"];

  it("accepts an exact route", () => {
    expect(routeExists("/admin/events", map)).toBe(true);
  });

  it("accepts a dynamic segment", () => {
    expect(routeExists("/admin/events/abc-123/control", map)).toBe(true);
  });

  it("accepts a catch-all", () => {
    expect(routeExists("/docs/a/b/c", map)).toBe(true);
  });

  it("ignores a query string and a hash", () => {
    expect(routeExists("/admin/events?tab=fields#top", map)).toBe(true);
  });

  it("leaves external links alone", () => {
    expect(routeExists("https://example.com", map)).toBe(true);
    expect(routeExists("mailto:x@y.com", map)).toBe(true);
  });

  it("rejects a path that leads nowhere — the whole point", () => {
    expect(routeExists("/admin/events/networking", map)).toBe(false);
  });

  it("rejects a partial match", () => {
    expect(routeExists("/admin/events/[id]", map)).toBe(false);
    expect(routeExists("/admin", map)).toBe(false);
  });
});

describe("reading the nav config", () => {
  it("finds the Event Hub items", () => {
    const labels = navHrefs.map((h) => h.label);
    expect(labels).toContain("Registration");
    expect(labels).toContain("Networking Matching");
  });

  it("pairs each href with its label, so a failure names the menu item", () => {
    const reg = navHrefs.find((h) => h.label === "Registration");
    expect(reg?.href).toBe("/admin/events/registrations");
  });

  it("finds enough items to be checking something real", () => {
    expect(navHrefs.length).toBeGreaterThan(30);
  });
});

describe("every navigation link resolves", () => {
  it("names any that does not", () => {
    const broken = navHrefs
      .filter((h) => !routeExists(h.href, routes))
      .map((h) => `${h.label} → ${h.href}`)
      .sort();

    expect(broken, `\nMenu items pointing at nothing:\n${broken.join("\n")}\n`).toEqual([]);
  });
});
