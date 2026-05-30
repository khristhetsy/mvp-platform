import { NextResponse } from "next/server";
import { requireFounderInvestorCrmApi } from "@/lib/api/founder-crm";
import { archiveFounderInvestorContact, updateFounderInvestorContact } from "@/lib/founder-crm/contacts";
import { founderInvestorContactSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireFounderInvestorCrmApi();
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = founderInvestorContactSchema.partial().safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid contact update." }, { status: 400 });
  }

  const archive = body && typeof body === "object" && (body as { archive?: boolean }).archive === true;

  const result = archive
    ? await archiveFounderInvestorContact(auth.supabase, auth.profile.id, id)
    : await updateFounderInvestorContact(auth.supabase, {
        contactId: id,
        founderId: auth.profile.id,
        patch: {
          investor_name: parsed.data.investor_name,
          firm_name: parsed.data.firm_name ?? undefined,
          email: parsed.data.email === "" ? null : parsed.data.email,
          phone: parsed.data.phone,
          website: parsed.data.website === "" ? null : parsed.data.website,
          linkedin_url: parsed.data.linkedin_url === "" ? null : parsed.data.linkedin_url,
          twitter_url: parsed.data.twitter_url === "" ? null : parsed.data.twitter_url,
          crunchbase_url: parsed.data.crunchbase_url === "" ? null : parsed.data.crunchbase_url,
          personal_website_url:
            parsed.data.personal_website_url === "" ? null : parsed.data.personal_website_url,
          other_social_url: parsed.data.other_social_url === "" ? null : parsed.data.other_social_url,
          investor_type: parsed.data.investor_type,
          preferred_sectors: parsed.data.preferred_sectors,
          preferred_stages: parsed.data.preferred_stages,
          check_size_min: parsed.data.check_size_min,
          check_size_max: parsed.data.check_size_max,
          geography: parsed.data.geography,
          tags: parsed.data.tags,
          notes: parsed.data.notes,
          status: parsed.data.status,
        },
      });

  if (result.error) {
    return NextResponse.json({ error: "Unable to update contact." }, { status: 400 });
  }

  return NextResponse.json({ contact: result.data });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireFounderInvestorCrmApi();
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  const result = await archiveFounderInvestorContact(auth.supabase, auth.profile.id, id);

  if (result.error) {
    return NextResponse.json({ error: "Unable to archive contact." }, { status: 400 });
  }

  return NextResponse.json({ contact: result.data });
}
