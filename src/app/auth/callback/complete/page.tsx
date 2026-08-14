"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const DASHBOARD_BY_ROLE: Record<string, string> = {
  founder: "/founder/dashboard",
  investor: "/investor/dashboard",
  admin: "/admin/dashboard",
  analyst: "/admin/dashboard",
};

/**
 * Implicit-flow fallback. When Supabase delivers the session in the URL #fragment
 * (rather than as ?code), the server /auth/callback route can't read it — so it
 * redirects here, the browser preserves the fragment, and this client page reads
 * the tokens, establishes the session, and routes by role (or to reset-password
 * for recovery links). Keeps sign-in working regardless of the Supabase flow.
 */
export default function AuthCallbackCompletePage() {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    void (async () => {
      const url = new URL(window.location.href);
      const nextParam = url.searchParams.get("next");
      const safeNext = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : null;

      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));

      const errorDescription = hash.get("error_description") ?? hash.get("error");
      if (errorDescription) {
        router.replace(`/auth/sign-in?message=${encodeURIComponent(errorDescription)}`);
        return;
      }

      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      if (!accessToken || !refreshToken) {
        router.replace("/auth/sign-in");
        return;
      }

      const supabase = createClient();
      const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (error) {
        router.replace(`/auth/sign-in?message=${encodeURIComponent(error.message)}`);
        return;
      }

      if (hash.get("type") === "recovery") {
        router.replace("/auth/reset-password");
        return;
      }

      let destination = "/founder/dashboard";
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
        const role = (profile?.role as string | undefined) ?? "founder";
        destination = DASHBOARD_BY_ROLE[role] ?? "/founder/dashboard";
      }
      router.replace(safeNext ?? destination);
    })();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center px-6 text-center text-sm text-slate-500">
      Signing you in…
    </div>
  );
}
