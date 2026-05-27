import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/data/audit";
import { createInvestorInterest } from "@/lib/data/investor-interests";
import { investorInterestSchema } from "@/lib/validation";

function readCampaignSlug(formData: FormData) {
  return (
    formData.get("campaignSlug")?.toString().trim() ||
    formData.get("campaignId")?.toString().trim() ||
    ""
  );
}

export async function POST(request: Request) {
  const auth = await requireApiProfile(["investor"]);

  if ("error" in auth) {
    return auth.error;
  }

  const formData = await request.formData();
  const campaignSlug = readCampaignSlug(formData);

  const parsed = investorInterestSchema.safeParse({
    campaignSlug,
    interestAmount: formData.get("interestAmount") || undefined,
    message: formData.get("message")?.toString() || undefined,
    requestedCall: formData.get("requestedCall") === "true",
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid investor interest request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const slug = parsed.data.campaignSlug;

  const { data, error } = await createInvestorInterest(auth.supabase, {
    investor_id: auth.profile.id,
    campaignSlug: slug,
    interest_amount: parsed.data.interestAmount,
    message: parsed.data.message,
    status: parsed.data.requestedCall ? "call_requested" : "new",
  });

  if (error) {
    if ("code" in error && error.code === "campaign_not_found") {
      return NextResponse.json(
        {
          error: `No campaign found for slug "${slug}". The opportunity may not exist or is not listed yet.`,
        },
        { status: 404 },
      );
    }

    const message = error.message ?? "Unable to save intro request.";
    const isUuidSyntaxError = message.includes("invalid input syntax for type uuid");

    return NextResponse.json(
      {
        error: isUuidSyntaxError
          ? `Could not save intro request for "${slug}". A slug was sent where a campaign UUID is required.`
          : message,
      },
      { status: 400 },
    );
  }

  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: "investor_interest.created",
    entityType: "investor_interest",
    entityId: data.id,
    metadata: { campaignId: data.campaign_id, campaignSlug: slug },
  });

  return NextResponse.json({
    interest: data,
  });
}
