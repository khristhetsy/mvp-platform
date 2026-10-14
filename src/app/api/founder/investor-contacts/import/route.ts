import { NextResponse } from "next/server";
import { requireFounderInvestorCrmApi } from "@/lib/api/founder-crm";
import { createFounderInvestorContact, listFounderInvestorContacts } from "@/lib/founder-crm/contacts";
import { dedupeImportRows, parseCsvImportRows } from "@/lib/founder-crm/csv-import";
import { notifyFounderImportCompleted } from "@/lib/notifications/founder-outreach-events";
import { founderInvestorContactImportSchema } from "@/lib/validation";
import { founderHoldStatus } from "@/lib/investor-directory/db";
import { decideAdd } from "@/lib/investor-directory/limits";

export async function POST(request: Request) {
  const auth = await requireFounderInvestorCrmApi();
  if ("error" in auth) {
    return auth.error;
  }

  const body = await request.json().catch(() => null);
  const parsed = founderInvestorContactImportSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid import payload." }, { status: 400 });
  }

  const existing = await listFounderInvestorContacts(auth.supabase, auth.profile.id, auth.company.id);
  const preview = dedupeImportRows(parseCsvImportRows(parsed.data.rows), existing.data ?? []);

  const hold = await founderHoldStatus(auth.profile.id, auth.company.id);
  if (!parsed.data.confirm) {
    return NextResponse.json({
      preview,
      validCount: preview.filter((row) => row.valid && !row.skipped).length,
      skippedCount: preview.filter((row) => row.skipped).length,
      hold,
    });
  }

  // One investor limit for every source: import the first rows that fit.
  const newRows = preview.filter((row) => row.valid && !row.skipped && row.data).length;
  let room = newRows;
  if (newRows > 0) {
    const decision = decideAdd(newRows, hold);
    if (!decision.ok) {
      return NextResponse.json({ error: decision.message, reason: "hold_limit", hold }, { status: 403 });
    }
    room = decision.allowed;
  }
  let overLimit = 0;

  let imported = 0;
  let skipped = 0;

  for (const row of preview) {
    if (!row.valid || row.skipped || !row.data) {
      skipped += 1;
      continue;
    }
    if (room <= 0) {
      overLimit += 1;
      continue;
    }

    const result = await createFounderInvestorContact(auth.supabase, {
      founderId: auth.profile.id,
      companyId: auth.company.id,
      investorName: row.data.investor_name,
      firmName: row.data.firm_name,
      email: row.data.email,
      investorType: row.data.investor_type,
      preferredSectors: row.data.preferred_sectors,
      preferredStages: row.data.preferred_stages,
      checkSizeMin: row.data.check_size_min,
      checkSizeMax: row.data.check_size_max,
      geography: row.data.geography,
      website: row.data.website,
      linkedinUrl: row.data.linkedin_url,
      twitterUrl: row.data.twitter_url,
      crunchbaseUrl: row.data.crunchbase_url,
      personalWebsiteUrl: row.data.personal_website_url,
      otherSocialUrl: row.data.other_social_url,
      notes: row.data.notes,
      source: parsed.data.source ?? "csv_import",
    });

    if (result.error) {
      skipped += 1;
    } else {
      imported += 1;
      room -= 1;
    }
  }

  void notifyFounderImportCompleted({
    founderId: auth.profile.id,
    imported,
    skipped,
  });

  return NextResponse.json({ imported, skipped, overLimit, preview });
}
