import { NextResponse } from "next/server";
import { requireInvestorApprovedApi } from "@/lib/api/investor";
import { getMessageThreadDetail, userCanAccessThread } from "@/lib/messaging/threads";
import type { MessageThreadRecord } from "@/lib/messaging/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/supabase/auth";
import type { UserRole } from "@/lib/supabase/types";

export async function requireMessagingSession() {
  const profile = await requireRole(["founder", "investor", "admin", "analyst"]);
  const supabase = await import("@/lib/supabase/server").then((m) => m.createServerSupabaseClient());
  const serviceSupabase = createServiceRoleClient();
  return { profile, supabase, serviceSupabase };
}

export async function requireFounderMessagingApi() {
  const profile = await requireRole(["founder"]);
  const { getFounderFeatureAccess } = await import("@/lib/subscriptions/founder-access");
  const access = await getFounderFeatureAccess("investor_access");
  if (!access.allowed) {
    return {
      error: NextResponse.json(
        { error: access.reason ?? "Upgrade to Founder Professional to use messaging.", code: "subscription_required" },
        { status: 403 },
      ),
    };
  }

  const supabase = await import("@/lib/supabase/server").then((m) => m.createServerSupabaseClient());
  const serviceSupabase = createServiceRoleClient();
  return { profile, supabase, serviceSupabase };
}

export async function loadThreadForUser(
  threadId: string,
  userId: string,
  role: UserRole,
  serviceSupabase: ReturnType<typeof createServiceRoleClient>,
) {
  const detail = await getMessageThreadDetail(serviceSupabase, threadId);
  if (detail.error || !detail.data) {
    return {
      error: NextResponse.json({ error: "Thread not found." }, { status: 404 }),
    };
  }

  if (!userCanAccessThread(detail.data.thread, userId, role)) {
    return { error: NextResponse.json({ error: "Forbidden." }, { status: 403 }) };
  }

  return { thread: detail.data.thread as MessageThreadRecord, detail: detail.data };
}

export { requireInvestorApprovedApi };
