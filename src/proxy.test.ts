import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { UserRole } from "@/lib/supabase/types";

// The proxy builds its own Supabase client from @supabase/ssr, so the client is
// swapped for a scripted one. Each test sets `state` before calling proxy().
type ProxyState = {
  user: { id: string } | null;
  profile: { role: string | null; is_super_admin?: boolean } | null;
  departmentCount: number;
  departmentCountError: unknown;
  features: Array<{ path: string }> | null;
  featuresError: unknown;
};

let state: ProxyState;

function defaultState(): ProxyState {
  return {
    user: { id: "user-1" },
    profile: null,
    departmentCount: 0,
    departmentCountError: null,
    features: [],
    featuresError: null,
  };
}

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: state.user }, error: null })),
    },
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        const chain = {
          select: () => chain,
          eq: () => chain,
          single: async () => ({ data: state.profile, error: state.profile ? null : { message: "missing" } }),
        };
        return chain;
      }
      if (table === "department_members") {
        const chain = {
          select: () => chain,
          eq: async () => ({ count: state.departmentCount, error: state.departmentCountError }),
        };
        return chain;
      }
      throw new Error(`unexpected table ${table}`);
    }),
    rpc: vi.fn(async () => ({ data: state.features, error: state.featuresError })),
  })),
}));

const { proxy } = await import("@/proxy");

const ROLES: UserRole[] = ["founder", "investor", "admin", "analyst"];
const ZONES = ["founder", "investor", "admin"] as const;
type Zone = (typeof ZONES)[number];

const ALLOWED: Record<UserRole, Zone[]> = {
  founder: ["founder"],
  investor: ["investor"],
  admin: ["founder", "investor", "admin"],
  analyst: ["founder", "investor", "admin"],
};

const DASHBOARD: Record<UserRole, string> = {
  founder: "/founder/dashboard",
  investor: "/investor/dashboard",
  admin: "/admin/dashboard",
  analyst: "/admin/dashboard",
};

// Paths per zone: the bare zone root, a nested page, and an API route.
function pagePaths(zone: Zone) {
  return [`/${zone}`, `/${zone}/settings`];
}
function apiPath(zone: Zone) {
  return `/api/${zone}/things`;
}

function request(path: string) {
  return new NextRequest(new URL(path, "https://app.test"));
}

function isPassThrough(res: Response) {
  return res.headers.get("x-middleware-next") === "1";
}

function redirectPath(res: Response) {
  const location = res.headers.get("location");
  return location ? new URL(location) : null;
}

beforeEach(() => {
  state = defaultState();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  vi.stubEnv("APP_ENV", "local");
  vi.stubEnv("ADMIN_API_DEPARTMENT_SCOPING", "");
  vi.stubEnv("ALLOW_UNAUTHENTICATED_LOCAL", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("proxy — every role against every zone", () => {
  for (const role of ROLES) {
    for (const zone of ZONES) {
      const allowed = ALLOWED[role].includes(zone);

      for (const path of pagePaths(zone)) {
        it(`${role} → page ${path} is ${allowed ? "allowed" : "redirected to own dashboard"}`, async () => {
          state.profile = { role, is_super_admin: false };
          const res = await proxy(request(path));
          if (allowed) {
            expect(isPassThrough(res)).toBe(true);
          } else {
            expect(res.status).toBe(307);
            expect(redirectPath(res)?.pathname).toBe(DASHBOARD[role]);
          }
        });
      }

      it(`${role} → api ${apiPath(zone)} is ${allowed ? "allowed" : "403"}`, async () => {
        state.profile = { role, is_super_admin: false };
        const res = await proxy(request(apiPath(zone)));
        if (allowed) {
          expect(isPassThrough(res)).toBe(true);
        } else {
          expect(res.status).toBe(403);
          expect(await res.json()).toEqual({ error: "Insufficient permissions." });
        }
      });
    }
  }

  it("matches the role column case-insensitively", async () => {
    state.profile = { role: "ADMIN" };
    expect(isPassThrough(await proxy(request("/admin/settings")))).toBe(true);
  });

  it("does not treat look-alike prefixes as a zone", async () => {
    state.profile = { role: "founder" };
    const res = await proxy(request("/administrator"));
    expect(isPassThrough(res)).toBe(true);
  });
});

describe("proxy — unauthenticated and unknown profiles, every zone", () => {
  for (const zone of ZONES) {
    it(`no session → page /${zone}/settings redirects to sign-in with next`, async () => {
      state.user = null;
      const url = redirectPath(await proxy(request(`/${zone}/settings`)));
      expect(url?.pathname).toBe("/auth/sign-in");
      expect(url?.searchParams.get("next")).toBe(`/${zone}/settings`);
    });

    it(`no session → api ${apiPath(zone)} is 401`, async () => {
      state.user = null;
      const res = await proxy(request(apiPath(zone)));
      expect(res.status).toBe(401);
    });

    for (const profile of [null, { role: null }, { role: "super_admin" }, { role: "guest" }]) {
      const label = profile === null ? "missing profile" : `role ${String(profile.role)}`;

      it(`${label} → page /${zone} redirects to sign-in with profile_required`, async () => {
        state.profile = profile;
        const url = redirectPath(await proxy(request(`/${zone}`)));
        expect(url?.pathname).toBe("/auth/sign-in");
        expect(url?.searchParams.get("error")).toBe("profile_required");
      });

      it(`${label} → api ${apiPath(zone)} is 403`, async () => {
        state.profile = profile;
        const res = await proxy(request(apiPath(zone)));
        expect(res.status).toBe(403);
        expect(await res.json()).toEqual({ error: "Profile not found." });
      });
    }
  }

  it("leaves public paths alone even without a session", async () => {
    state.user = null;
    for (const path of ["/", "/marketplace/x", "/api/public/thing", "/founders"]) {
      expect(isPassThrough(await proxy(request(path)))).toBe(true);
    }
  });
});

describe("proxy — unconfigured Supabase fails closed", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  });

  for (const zone of ZONES) {
    it(`page /${zone} redirects to /configuration-error`, async () => {
      expect(redirectPath(await proxy(request(`/${zone}`)))?.pathname).toBe("/configuration-error");
    });

    it(`api ${apiPath(zone)} is 503`, async () => {
      expect((await proxy(request(apiPath(zone)))).status).toBe(503);
    });
  }

  it("passes through only with the explicit local bypass", async () => {
    vi.stubEnv("ALLOW_UNAUTHENTICATED_LOCAL", "true");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(isPassThrough(await proxy(request("/admin")))).toBe(true);
  });

  it("ignores the local bypass in production", async () => {
    vi.stubEnv("ALLOW_UNAUTHENTICATED_LOCAL", "true");
    vi.stubEnv("APP_ENV", "production");
    expect(redirectPath(await proxy(request("/admin")))?.pathname).toBe("/configuration-error");
  });
});

describe("proxy — admin zone department scoping", () => {
  for (const role of ["admin", "analyst"] as const) {
    it(`${role} in a department without the feature is sent back to the dashboard (page)`, async () => {
      state.profile = { role };
      state.departmentCount = 1;
      state.features = [{ path: "/admin/crm" }];
      const url = redirectPath(await proxy(request("/admin/billing")));
      expect(url?.pathname).toBe("/admin/dashboard");
      expect(url?.searchParams.get("denied")).toBe("1");
    });

    it(`${role} in a department with the feature is allowed (page)`, async () => {
      state.profile = { role };
      state.departmentCount = 1;
      state.features = [{ path: "/admin/crm" }];
      expect(isPassThrough(await proxy(request("/admin/crm/leads")))).toBe(true);
    });

    it(`${role} super admin skips department scoping`, async () => {
      state.profile = { role, is_super_admin: true };
      state.departmentCount = 1;
      state.features = [];
      expect(isPassThrough(await proxy(request("/admin/billing")))).toBe(true);
    });
  }

  it("exempt admin pages are never department-scoped", async () => {
    state.profile = { role: "analyst" };
    state.departmentCount = 1;
    state.features = [];
    for (const path of ["/admin", "/admin/dashboard", "/admin/profile/edit", "/admin/accounts"]) {
      expect(isPassThrough(await proxy(request(path)))).toBe(true);
    }
  });

  it("department scoping does not apply to founder or investor zones", async () => {
    state.profile = { role: "admin" };
    state.departmentCount = 1;
    state.features = [];
    expect(isPassThrough(await proxy(request("/founder/settings")))).toBe(true);
    expect(isPassThrough(await proxy(request("/investor/settings")))).toBe(true);
  });

  it("a failed lookup keeps admin pages permissive", async () => {
    state.profile = { role: "admin" };
    state.departmentCountError = { message: "down" };
    expect(isPassThrough(await proxy(request("/admin/billing")))).toBe(true);
  });

  it("api in default warn mode logs but allows a denied feature", async () => {
    state.profile = { role: "admin" };
    state.departmentCount = 1;
    state.features = [{ path: "/admin/crm" }];
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(isPassThrough(await proxy(request("/api/admin/billing")))).toBe(true);
    expect(warn).toHaveBeenCalledOnce();
  });

  it("api in enforce mode returns 403 for a denied feature", async () => {
    vi.stubEnv("ADMIN_API_DEPARTMENT_SCOPING", "enforce");
    state.profile = { role: "analyst" };
    state.departmentCount = 1;
    state.features = [{ path: "/admin/crm" }];
    expect((await proxy(request("/api/admin/billing"))).status).toBe(403);
    expect(isPassThrough(await proxy(request("/api/admin/crm/export")))).toBe(true);
  });

  it("api in enforce mode fails closed (503) when the lookup is unavailable", async () => {
    vi.stubEnv("ADMIN_API_DEPARTMENT_SCOPING", "enforce");
    state.profile = { role: "admin" };
    state.departmentCount = 1;
    state.featuresError = { message: "rpc down" };
    expect((await proxy(request("/api/admin/billing"))).status).toBe(503);
  });

  it("api in off mode skips the check", async () => {
    vi.stubEnv("ADMIN_API_DEPARTMENT_SCOPING", "off");
    state.profile = { role: "admin" };
    state.departmentCount = 1;
    state.features = [];
    expect(isPassThrough(await proxy(request("/api/admin/billing")))).toBe(true);
  });
});
