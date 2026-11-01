// POST /api/mobile/test-login  { email }
// TEST BUILDS ONLY. Lets the iCapOS 2.0 test app sign in a test founder without a password.
// It is locked three ways:
//   1. It does nothing outside the local dev server (NODE_ENV must be "development" and VERCEL must be unset).
//   2. Only the fixed test accounts below can be used.
//   3. The account must be a founder. Admin accounts are always refused.
// It returns a one time token hash. The app swaps it for a session. Nothing is emailed.
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const TEST_ACCOUNTS = ["info@myicfos.com", "kthetsy+apptest@gmail.com", "kthetsy@gmail.com"];

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development" || process.env.VERCEL) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as { email?: unknown };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!TEST_ACCOUNTS.includes(email)) {
    return NextResponse.json({ error: "This email is not a test account." }, { status: 403 });
  }

  const admin = createServiceRoleClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("email", email).maybeSingle();
  if (!profile || profile.role !== "founder") {
    return NextResponse.json({ error: "This account is not a founder." }, { status: 403 });
  }

  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const hashed = data?.properties?.hashed_token;
  if (error || !hashed) return NextResponse.json({ error: "Could not create a sign in." }, { status: 500 });
  return NextResponse.json({ token_hash: hashed }, { headers: { "Cache-Control": "no-store" } });
}
