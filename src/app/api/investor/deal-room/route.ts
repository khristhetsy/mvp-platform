import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";

export async function GET() {
  const auth = await requireApiProfile(["investor"]);
  if ("error" in auth) return auth.error;

  const { data, error } = await auth.supabase
    .from("deal_rooms")
    .select("id, company_id, status, title, created_at, updated_at")
    .eq("investor_user_id", auth.profile.id)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ rooms: data ?? [] });
}

