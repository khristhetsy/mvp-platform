import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { importInvestorContactsAsProspects } from "@/lib/matching/prospect-investors";

export const dynamic = "force-dynamic";

async function requireStaff(): Promise<{ userId: string } | { error: Response }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  if (!profile || (profile.role !== "admin" && profile.role !== "analyst")) {
    return { error: NextResponse.json({ error: "Admins only." }, { status: 403 }) };
  }

  return { userId: user.id };
}

// POST — import investor CRM contacts (module = 'investor') into prospect_investors.
export async function POST(): Promise<Response> {
  const gate = await requireStaff();
  if ("error" in gate) return gate.error;

  const result = await importInvestorContactsAsProspects(gate.userId);
  return NextResponse.json(result);
}
