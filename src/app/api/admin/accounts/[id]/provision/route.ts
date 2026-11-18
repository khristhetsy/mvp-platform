import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getOrganization } from "@/lib/organizations/organizations";
import { provisionDemoFounder } from "@/lib/organizations/provision-demo-founder";

export const dynamic = "force-dynamic";

// POST — set up the founder profile and company for an admin-created Founder account
// that was created without them. Only admin-direct accounts: a real founder always
// comes through signup.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiProfile(["admin", "analyst"]);
  if ("error" in auth) return auth.error;
  const { id } = await params;

  const admin = createServiceRoleClient();
  const org = await getOrganization(admin, id);
  if (!org) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  if (org.created_via !== "admin_direct" || org.type !== "founder") {
    return NextResponse.json({ error: "Only admin-created Founder accounts can be set up here." }, { status: 400 });
  }

  try {
    const result = await provisionDemoFounder(admin, org);
    return NextResponse.json({ founderId: result.founderId, founderName: org.name, created: result.created });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not set up the founder." }, { status: 500 });
  }
}
