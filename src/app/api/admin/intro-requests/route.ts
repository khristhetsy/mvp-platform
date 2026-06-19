import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole(["admin", "analyst"]);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createServiceRoleClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (admin as any)
    .from("intro_requests")
    .select(
      "id, status, message, facilitator_note, facilitated_at, created_at, updated_at, profiles!investor_id(full_name, email), companies(company_name, id)",
    )
    .order("created_at", { ascending: false });

  const { data, error } = result as {
    data: Array<Record<string, unknown>> | null;
    error: unknown;
  };

  if (error) {
    console.error("Admin intro-requests list error:", error);
    return NextResponse.json({ error: "Failed to load intro requests" }, { status: 500 });
  }

  return NextResponse.json({ introRequests: data ?? [] });
}
