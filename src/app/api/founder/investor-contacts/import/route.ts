import { NextResponse } from "next/server";
import { requireFounderInvestorCrmApi } from "@/lib/api/founder-crm";
import {
  createFounderInvestorContact,
  listFounderInvestorContacts,
  updateFounderInvestorContact,
} from "@/lib/founder-crm/contacts";
import {
  dedupeImportRows,
  fillEmptyPatch,
  parseCsvImportRows,
  presentFields,
  type FillableField,
} from "@/lib/founder-crm/csv-import";
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

  // Default: an email that is already a contact gets its empty fields filled in.
  const fillExisting = parsed.data.duplicateMode !== "skip";

  const existing = await listFounderInvestorContacts(auth.supabase, auth.profile.id, auth.company.id);
  const existingByEmail = new Map(
    (existing.data ?? [])
      .filter((contact) => contact.email)
      .map((contact) => [contact.email!.toLowerCase(), contact] as const),
  );
  const preview = dedupeImportRows(parseCsvImportRows(parsed.data.rows), existing.data ?? []);

  const hold = await founderHoldStatus(auth.profile.id, auth.company.id);
  if (!parsed.data.confirm) {
    return NextResponse.json({
      preview,
      validCount: preview.filter((row) => row.valid && !row.skipped).length,
      updateCount: fillExisting ? preview.filter((row) => row.valid && row.existing).length : 0,
      skippedCount: preview.filter((row) => row.skipped && !(fillExisting && row.existing)).length,
      hold,
    });
  }

  // One investor limit for every source: import the first rows that fit.
  // Filling an existing contact adds no investor, so it never counts toward the limit.
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
  let updated = 0;
  let unchanged = 0;
  let skipped = 0;
  let failed = 0;
  // How many saved contacts carry a value for each field, so the founder can see what was kept.
  const fieldCounts: Record<string, number> = {};
  const count = (field: FillableField | "name" | "email") => {
    fieldCounts[field] = (fieldCounts[field] ?? 0) + 1;
  };

  for (const row of preview) {
    if (!row.valid || !row.data) {
      skipped += 1;
      continue;
    }

    if (row.existing) {
      const match = row.data.email ? existingByEmail.get(row.data.email) : undefined;
      if (!fillExisting || !match) {
        skipped += 1;
        continue;
      }
      const { patch, filled } = fillEmptyPatch(match, row.data);
      if (filled.length === 0) {
        // The contact already has everything this row carries.
        unchanged += 1;
        continue;
      }
      const result = await updateFounderInvestorContact(auth.supabase, {
        contactId: match.id,
        founderId: auth.profile.id,
        patch,
      });
      if (result.error) {
        failed += 1;
        continue;
      }
      // Keep the in memory copy current so a repeat of this email later in the file fills only what is still empty.
      Object.assign(match, patch);
      updated += 1;
      count("name");
      count("email");
      filled.forEach(count);
      continue;
    }

    if (row.skipped) {
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
      phone: row.data.phone,
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
      failed += 1;
    } else {
      imported += 1;
      room -= 1;
      count("name");
      if (row.data.email) count("email");
      presentFields(row.data).forEach(count);
    }
  }

  void notifyFounderImportCompleted({
    founderId: auth.profile.id,
    imported: imported + updated,
    skipped: skipped + failed,
  });

  return NextResponse.json({ imported, updated, unchanged, skipped, failed, overLimit, fieldCounts, preview });
}
