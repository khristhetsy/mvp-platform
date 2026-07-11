import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database, UserRole } from "@/lib/supabase/types";

/** Edge-safe env reads — mirrors @/lib/env helpers used here without importing that module. */
function trimEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function getPublicSupabaseEnv() {
  const url = trimEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = trimEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return { url, anonKey, configured: Boolean(url && anonKey) };
}

function isProductionEnvironment(): boolean {
  const explicit = trimEnv("APP_ENV")?.toLowerCase();
  if (explicit === "production") return true;
  if (explicit === "local" || explicit === "staging") return false;

  const vercelEnv = trimEnv("VERCEL_ENV");
  if (vercelEnv === "production") return true;

  return false;
}

type WorkspaceZone = "founder" | "investor" | "admin";

const dashboardByRole: Record<UserRole, string> = {
  founder: "/founder/dashboard",
  investor: "/investor/dashboard",
  admin: "/admin/dashboard",
  analyst: "/admin/dashboard",
};

const allowedRolesByZone: Record<WorkspaceZone, UserRole[]> = {
  founder: ["founder", "admin", "analyst"],
  investor: ["investor", "admin", "analyst"],
  admin: ["admin", "analyst"],
};

const protectedPageExactPaths = ["/founder", "/investor", "/admin"];
const protectedPagePrefixes = ["/founder/", "/investor/", "/admin/"];
const protectedApiPrefixes = ["/api/founder/", "/api/investor/", "/api/admin/"];

function isKnownRole(role: string | null | undefined): role is UserRole {
  return role === "founder" || role === "investor" || role === "admin" || role === "analyst";
}

function resolveWorkspaceZone(pathname: string): WorkspaceZone | null {
  if (pathname === "/founder" || pathname.startsWith("/founder/")) {
    return "founder";
  }
  if (pathname === "/investor" || pathname.startsWith("/investor/")) {
    return "investor";
  }
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return "admin";
  }
  if (pathname.startsWith("/api/founder/")) {
    return "founder";
  }
  if (pathname.startsWith("/api/investor/")) {
    return "investor";
  }
  if (pathname.startsWith("/api/admin/")) {
    return "admin";
  }
  return null;
}

function shouldProtectPath(pathname: string) {
  return (
    protectedPageExactPaths.includes(pathname) ||
    protectedPagePrefixes.some((prefix) => pathname.startsWith(prefix)) ||
    protectedApiPrefixes.some((prefix) => pathname.startsWith(prefix))
  );
}

function isApiRequest(pathname: string) {
  return pathname.startsWith("/api/");
}

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;

  if (!shouldProtectPath(pathname)) {
    return response;
  }

  const zone = resolveWorkspaceZone(pathname);
  if (!zone) {
    return response;
  }

  const { url: supabaseUrl, anonKey: supabaseAnonKey, configured } = getPublicSupabaseEnv();
  const apiRequest = isApiRequest(pathname);

  if (!configured) {
    if (isProductionEnvironment()) {
      if (apiRequest) {
        return jsonError(503, "Authentication service is not configured.");
      }
      const url = request.nextUrl.clone();
      url.pathname = "/configuration-error";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return response;
  }

  const supabase = createServerClient<Database>(supabaseUrl!, supabaseAnonKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (apiRequest) {
      return jsonError(401, "Authentication required.");
    }
    const url = request.nextUrl.clone();
    url.pathname = "/auth/sign-in";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role?.toLowerCase();

  if (!isKnownRole(role)) {
    if (apiRequest) {
      return jsonError(403, "Profile not found.");
    }
    const url = request.nextUrl.clone();
    url.pathname = "/auth/sign-in";
    url.searchParams.set("next", pathname);
    url.searchParams.set("error", "profile_required");
    return NextResponse.redirect(url);
  }

  const allowedRoles = allowedRolesByZone[zone];
  if (!allowedRoles.includes(role)) {
    if (apiRequest) {
      return jsonError(403, "Insufficient permissions.");
    }
    const url = request.nextUrl.clone();
    url.pathname = dashboardByRole[role];
    return NextResponse.redirect(url);
  }

  // ── Department-scoped access (admin PAGE routes, all internal users) ──
  // Scoping is by DEPARTMENT membership, not role. Admin-department members and
  // unassigned users bypass (the RPC returns all features for admin-dept members;
  // unassigned users are skipped by the count check below). Anyone assigned to a
  // non-admin department is scoped to their granted feature paths. Fails OPEN on
  // any error so a registry gap never locks staff out. Landing/profile always OK.
  if (zone === "admin" && !apiRequest) {
    const p = pathname;
    const exempt =
      p === "/admin" ||
      p === "/admin/dashboard" || p.startsWith("/admin/dashboard/") ||
      p === "/admin/profile" || p.startsWith("/admin/profile/") ||
      // CEO Hub is a platform-admin surface with its own requireRole(["admin"])
      // gate; it is not a departmental feature, so skip the department check here.
      p === "/admin/ceo" || p.startsWith("/admin/ceo/") ||
      // Calendar / Scheduling / Meet are personal productivity tools (each with its
      // own requireRole(["admin","analyst"]) gate), not departmental features, so
      // they are not registered in the feature registry and would otherwise be
      // wrongly denied. Skip the department check here.
      p === "/admin/calendar" || p.startsWith("/admin/calendar/") ||
      p === "/admin/schedule" || p.startsWith("/admin/schedule/") ||
      p === "/admin/meet" || p.startsWith("/admin/meet/") ||
      // Weekly management meeting board — a CEO/management surface with its own
      // requireRole gate, not a departmental feature.
      p === "/admin/meetings" || p.startsWith("/admin/meetings/");
    if (!exempt) {
      try {
        const { count } = await supabase
          .from("department_members")
          .select("user_id", { count: "exact", head: true })
          .eq("user_id", user.id);
        if ((count ?? 0) > 0) {
          // get_user_features is not in the generated types yet → loose call.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: feats, error } = await (supabase.rpc as any)("get_user_features", { p_user_id: user.id });
          if (!error && Array.isArray(feats)) {
            const paths = (feats as Array<{ path: string }>).map((f) => f.path);
            const allowed = paths.some((fp) => (fp === "/admin" ? p === "/admin" : p === fp || p.startsWith(`${fp}/`)));
            if (!allowed) {
              const url = request.nextUrl.clone();
              url.pathname = "/admin/dashboard";
              url.search = "";
              url.searchParams.set("denied", "1");
              return NextResponse.redirect(url);
            }
          }
        }
      } catch {
        /* fail open — never lock out on a transient error or missing tables */
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/founder",
    "/founder/:path*",
    "/investor",
    "/investor/:path*",
    "/admin",
    "/admin/:path*",
    "/api/founder/:path*",
    "/api/investor/:path*",
    "/api/admin/:path*",
  ],
};
