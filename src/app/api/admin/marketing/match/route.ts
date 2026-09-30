import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { createMatchCampaign } from "@/lib/match-campaigns/service";

export const dynamic = "force-dynamic";

// POST /api/admin/marketing/match — create a Match campaign (step 1). Admin only.
export async function POST(request: Request) {
  const auth = await requireApiProfile(["admin"]);
  if ("error" in auth) return auth.error;
  const body = (await request.json().catch(() => null)) as { name?: string; from_name?: string; from_email?: string; reply_to?: string | null } | null;
  if (!body?.name?.trim() || !body.from_name?.trim() || !body.from_email?.trim()) {
    return NextResponse.json({ error: "Campaign name, from name and from email are required." }, { status: 400 });
  }
  try {
    const campaign = await createMatchCampaign(
      { name: body.name, from_name: body.from_name, from_email: body.from_email, reply_to: body.reply_to ?? null },
      auth.profile.id,
    );
    return NextResponse.json({ campaign });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not create the campaign." }, { status: 500 });
  }
}
