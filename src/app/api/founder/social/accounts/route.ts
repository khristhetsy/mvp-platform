import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireFounderSocial, socialDb } from "@/lib/social/founder-auth";
import { deriveStatus } from "@/lib/social/accounts";

export const dynamic = "force-dynamic";

// The founder's own connected accounts. Tokens are never returned.
export async function GET(): Promise<Response> {
  const auth = await requireFounderSocial();
  if ("error" in auth) return auth.error;
  const { data, error } = await socialDb().from("social_accounts")
    .select("id, platform, display_name, status, token_expires_at")
    .eq("owner_profile_id", auth.founderId).neq("status", "disconnected").order("created_at", { ascending: true }).limit(20);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const accounts = ((data ?? []) as Array<{ id: string; platform: string; display_name: string | null; status: string; token_expires_at: string | null }>)
    .map((a) => ({ id: a.id, platform: a.platform, displayName: a.display_name, status: a.status === "disconnected" ? a.status : deriveStatus(a.token_expires_at) }));
  return NextResponse.json({ accounts });
}

export async function DELETE(req: NextRequest): Promise<Response> {
  const auth = await requireFounderSocial();
  if ("error" in auth) return auth.error;
  const parsed = z.object({ id: z.string().uuid() }).safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { data, error } = await socialDb().from("social_accounts")
    .update({ status: "disconnected", disconnected_at: new Date().toISOString(), access_token: null, refresh_token: null, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.id).eq("owner_profile_id", auth.founderId).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!(data ?? []).length) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
