import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database, UserRole } from "@/lib/supabase/types";

const protectedExactPaths = ["/founder", "/investor", "/admin"];
const protectedPrefixes = ["/founder/", "/investor/", "/admin/"];
const rolePrefixes: Record<string, UserRole[]> = {
  "/founder/": ["founder", "admin", "analyst"],
  "/investor/": ["investor", "admin", "analyst"],
  "/admin/": ["admin", "analyst"],
};

const dashboardByRole: Record<UserRole, string> = {
  founder: "/founder/dashboard",
  investor: "/investor/dashboard",
  admin: "/admin/dashboard",
  analyst: "/admin/dashboard",
};

function isKnownRole(role: string | null | undefined): role is UserRole {
  return role === "founder" || role === "investor" || role === "admin" || role === "analyst";
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
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

  const pathname = request.nextUrl.pathname;
  const shouldProtect =
    protectedExactPaths.includes(pathname) || protectedPrefixes.some((prefix) => pathname.startsWith(prefix));

  if (!shouldProtect) {
    return response;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/sign-in";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role?.toLowerCase();

  if (!isKnownRole(role)) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/sign-in";
    url.searchParams.set("next", pathname);
    url.searchParams.set("error", "profile_required");
    return NextResponse.redirect(url);
  }

  for (const [prefix, allowedRoles] of Object.entries(rolePrefixes)) {
    const exactPath = prefix.slice(0, -1);

    if ((pathname === exactPath || pathname.startsWith(prefix)) && !allowedRoles.includes(role)) {
      const url = request.nextUrl.clone();
      url.pathname = dashboardByRole[role];
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
