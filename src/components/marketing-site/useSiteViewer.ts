"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { dashboardForRole } from "@/lib/supabase/dashboard-path";
import type { UserRole } from "@/lib/supabase/types";

export type SiteViewer =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "signed-in"; name: string; email: string; initials: string; dashboardHref: string };

const ROLES: readonly UserRole[] = ["founder", "investor", "admin", "analyst"];

function initialsFor(name: string, email: string) {
  const source = name.trim() || email.split("@")[0] || "";
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  const letters = parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : source.slice(0, 2);
  return letters.toUpperCase() || "?";
}

/**
 * Who is looking at a public marketing page. Reads the Supabase session in the
 * browser so SiteNav can swap "Sign in / Get started" for the visitor's avatar
 * and a Dashboard link, without making every public page dynamic. Falls back to
 * signed-out on any error (missing env, network), so the nav never breaks.
 */
export function useSiteViewer(): [SiteViewer, (v: SiteViewer) => void] {
  const [viewer, setViewer] = useState<SiteViewer>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    let supabase: ReturnType<typeof createClient> | null = null;
    try {
      supabase = createClient();
    } catch {
      supabase = null;
    }

    const load = async () => {
      try {
        if (!supabase) throw new Error("Supabase is not configured");
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) setViewer({ status: "signed-out" });
          return;
        }
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email, role")
          .eq("id", user.id)
          .maybeSingle();
        const email = profile?.email ?? user.email ?? "";
        const name = profile?.full_name?.trim() || email;
        const rawRole = String(profile?.role ?? "").toLowerCase() as UserRole;
        const role = ROLES.includes(rawRole) ? rawRole : "founder";
        if (!cancelled) {
          setViewer({
            status: "signed-in",
            name,
            email,
            initials: initialsFor(profile?.full_name ?? "", email),
            dashboardHref: dashboardForRole(role),
          });
        }
      } catch {
        if (!cancelled) setViewer({ status: "signed-out" });
      }
    };

    void load();
    const sub = supabase?.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") void load();
    });

    return () => {
      cancelled = true;
      sub?.data.subscription.unsubscribe();
    };
  }, []);

  return [viewer, setViewer];
}
