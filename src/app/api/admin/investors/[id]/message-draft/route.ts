import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApi } from "@/lib/api/admin";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { generateReviewMessage } from "@/lib/investor/review-message";

const bodySchema = z.object({
  action: z.enum(["approve", "reject", "changes_requested"]),
  feedback: z.string().max(5000).optional(),
});

// Draft an AI investor-review message for the given decision, grounded on the
// investor's real profile. Staff-only. Never sends — returns the draft text.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) return auth.error as NextResponse;

  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid draft request." }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("investor_profiles")
    .select("preferred_sectors, preferred_stages, preferred_geographies, investment_thesis, profile_id")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Investor profile not found." }, { status: 404 });
  }

  const investor = data as {
    preferred_sectors: string[] | null;
    preferred_stages: string[] | null;
    preferred_geographies: string[] | null;
    investment_thesis: string | null;
    profile_id: string;
  };

  const { data: recipient } = await admin
    .from("profiles")
    .select("full_name, email")
    .eq("id", investor.profile_id)
    .single();
  const person = recipient as { full_name: string | null; email: string | null } | null;
  const investorName = person?.full_name?.trim() || person?.email || "Investor";

  const { message, ai } = await generateReviewMessage({
    action: parsed.data.action,
    investorName,
    sectors: investor.preferred_sectors,
    stages: investor.preferred_stages,
    geographies: investor.preferred_geographies,
    thesis: investor.investment_thesis,
    feedback: parsed.data.feedback,
  });

  return NextResponse.json({ message, ai });
}
