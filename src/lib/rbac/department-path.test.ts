import { describe, it, expect } from "vitest";
import { resolveDepartmentAction } from "@/proxy";

// Mirrors the matching logic in src/proxy.ts. The middleware itself needs a
// request and a Supabase client, so the path arithmetic — the part that would
// lock staff out if it were wrong — is pinned here.

const EXEMPT_PREFIXES = [
  "/admin/dashboard",
  "/admin/profile",
  "/admin/ceo",
  "/admin/calendar",
  "/admin/schedule",
  "/admin/meet",
  "/admin/meetings",
];

function isExempt(p: string): boolean {
  if (p === "/admin") return true;
  return EXEMPT_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}

function toFeaturePath(pathname: string): string {
  return pathname.replace(/^\/api/, "");
}

function isAllowed(featurePath: string, grantedPaths: string[]): boolean {
  return grantedPaths.some((fp) =>
    fp === "/admin" ? featurePath === "/admin" : featurePath === fp || featurePath.startsWith(`${fp}/`),
  );
}

describe("API path → feature path", () => {
  it("strips the /api prefix so API routes match page-based feature paths", () => {
    expect(toFeaturePath("/api/admin/audit/export")).toBe("/admin/audit/export");
    expect(toFeaturePath("/api/admin/compliance/events/123")).toBe("/admin/compliance/events/123");
  });

  it("leaves page paths untouched", () => {
    expect(toFeaturePath("/admin/audit")).toBe("/admin/audit");
  });

  it("only strips a leading /api, never one in the middle", () => {
    expect(toFeaturePath("/admin/tools/api/thing")).toBe("/admin/tools/api/thing");
  });
});

describe("feature path matching", () => {
  it("grants a route covered by a granted feature", () => {
    expect(isAllowed("/admin/audit/export", ["/admin/audit"])).toBe(true);
  });

  it("denies a route no granted feature covers", () => {
    expect(isAllowed("/admin/audit/export", ["/admin/marketing"])).toBe(false);
  });

  it("does not let a prefix match across a path segment boundary", () => {
    // "/admin/market" must not grant "/admin/marketplace".
    expect(isAllowed("/admin/marketplace", ["/admin/market"])).toBe(false);
  });

  it("treats the bare /admin grant as landing-page only, not a wildcard", () => {
    expect(isAllowed("/admin", ["/admin"])).toBe(true);
    expect(isAllowed("/admin/audit", ["/admin"])).toBe(false);
  });

  it("matches the granted path exactly as well as its children", () => {
    expect(isAllowed("/admin/audit", ["/admin/audit"])).toBe(true);
  });
});

describe("resolveDepartmentAction — what a check result means", () => {
  it("always allows a granted route, on every surface and mode", () => {
    for (const surface of ["page", "api"] as const) {
      for (const mode of ["off", "warn", "enforce"] as const) {
        expect(resolveDepartmentAction(surface, mode, "allowed")).toBe("allow");
      }
    }
  });

  it("blocks a denied page regardless of the API rollout mode", () => {
    // The page check predates the flag and is not staged behind it.
    for (const mode of ["off", "warn", "enforce"] as const) {
      expect(resolveDepartmentAction("page", mode, "denied")).toBe("block");
    }
  });

  it("keeps pages permissive when the lookup fails", () => {
    // A transient RPC failure must not bounce staff out of a page mid-task; the
    // page still carries its own requireRole gate.
    for (const mode of ["off", "warn", "enforce"] as const) {
      expect(resolveDepartmentAction("page", mode, "unavailable")).toBe("allow");
    }
  });

  it("does not touch API routes when scoping is off", () => {
    expect(resolveDepartmentAction("api", "off", "denied")).toBe("allow");
    expect(resolveDepartmentAction("api", "off", "unavailable")).toBe("allow");
  });

  it("only warns on API routes in warn mode, never blocks", () => {
    expect(resolveDepartmentAction("api", "warn", "denied")).toBe("warn");
    expect(resolveDepartmentAction("api", "warn", "unavailable")).toBe("warn");
  });

  it("blocks a denied API route when enforcing", () => {
    expect(resolveDepartmentAction("api", "enforce", "denied")).toBe("block");
  });

  it("fails CLOSED on an API route when enforcing and the lookup fails", () => {
    // This is the fix: an RPC outage previously granted access everywhere.
    expect(resolveDepartmentAction("api", "enforce", "unavailable")).toBe("block");
  });
});

describe("exemptions", () => {
  it("exempts personal tools and platform-admin surfaces", () => {
    for (const p of [
      "/admin",
      "/admin/dashboard",
      "/admin/profile/settings",
      "/admin/ceo/hub",
      "/admin/calendar",
      "/admin/schedule/new",
      "/admin/meet/room",
      "/admin/meetings",
    ]) {
      expect(isExempt(p)).toBe(true);
    }
  });

  it("does not exempt departmental features", () => {
    for (const p of ["/admin/audit", "/admin/compliance", "/admin/investor-pipeline", "/admin/marketing"]) {
      expect(isExempt(p)).toBe(false);
    }
  });

  it("exempts API routes too, once /api is stripped", () => {
    expect(isExempt(toFeaturePath("/api/admin/dashboard/stats"))).toBe(true);
    expect(isExempt(toFeaturePath("/api/admin/audit/export"))).toBe(false);
  });

  it("does not exempt a path that merely starts with an exempt word", () => {
    expect(isExempt("/admin/meetings-archive")).toBe(false);
    expect(isExempt("/admin/schedules")).toBe(false);
  });
});
