import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// GET /api/admin/events/guests/search-users?q=… — user picker for the Talk Show
// guest roster. Returns up to 8 active platform users { id, name, email, role }.
// The returned id is stored as session_guests.profile_id and equals the Zoom
// Video SDK user_identity, so "Bring on" can match a guest to their live tile.
export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 1) return NextResponse.json({ users: [] });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = createServiceRoleClient();
  const like = `%${q.replace(/[%_]/g, "")}%`;
  const { data } = await db
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("is_active", true)
    .or(`full_name.ilike.${like},email.ilike.${like}`)
    .order("full_name", { ascending: true, nullsFirst: false })
    .limit(8);

  const users = ((data ?? []) as Array<{ id: string; full_name: string | null; email: string | null; role: string | null }>)
    .map((u) => ({ id: u.id, name: u.full_name ?? u.email ?? "Unnamed user", email: u.email ?? "", role: u.role ?? "" }));
  return NextResponse.json({ users });
}
