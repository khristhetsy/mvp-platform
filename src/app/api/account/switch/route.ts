import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireApiProfile } from "@/lib/api/auth";
import { isOrgMember } from "@/lib/organizations/organizations";

export const dynamic = "force-dynamic";

// POST — switch the active org. The active org lives in a cookie but is ALWAYS
// re-validated against memberships server-side before it's set (spec §7 step 5),
// so a tampered cookie can never grant access to an org the user doesn't belong to.
export async function POST(request: Request) {
  const auth = await requireApiProfile(["founder", "investor", "admin", "analyst"]);
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => null)) as { orgId?: string } | null;
  const orgId = body?.orgId?.trim();
  if (!orgId) return NextResponse.json({ error: "orgId is required." }, { status: 400 });

  const member = await isOrgMember(auth.supabase, auth.profile.id, orgId);
  if (!member) return NextResponse.json({ error: "You are not a member of that account." }, { status: 403 });

  const jar = await cookies();
  jar.set("active_org", orgId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return NextResponse.json({ ok: true, activeOrgId: orgId });
}
