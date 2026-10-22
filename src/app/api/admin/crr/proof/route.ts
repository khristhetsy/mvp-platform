/** Founder CRR Proof: every company's before and after, quote permission and platform activity. Admin/analyst, read only. */
import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadProof } from "@/lib/crr/proof-db";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireApiProfile(["admin", "analyst"]);
  if ("error" in auth) return auth.error;
  try {
    return NextResponse.json(await loadProof(createServiceRoleClient()));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't load the proof data." }, { status: 500 });
  }
}
