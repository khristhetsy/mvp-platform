import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { ensureCompanySlug } from "@/lib/data/marketplace";
import { listCompanyDocuments } from "@/lib/data/documents";
import { computeDataRoomState } from "@/lib/data-room/completeness";
import { track } from "@/lib/analytics/posthog";
import type { Database } from "@/lib/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const BodySchema = z.object({
  action: z.enum(["publish", "unpublish"]),
});

export async function POST(request: Request) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const admin = createServiceRoleClient() as SupabaseClient<Database>;

  // Fetch company
  const { data: company, error: companyError } = await admin
    .from("companies")
    .select("id, company_name, slug, is_published, published_at")
    .eq("founder_id", auth.profile.id)
    .maybeSingle();

  if (companyError) return NextResponse.json({ error: "Failed to load company" }, { status: 500 });

  if (!company) {
    return NextResponse.json({ error: "No company found." }, { status: 404 });
  }

  if (parsed.data.action === "publish") {
    // Hard gate: a founder cannot list to investors until the core diligence
    // documents (pitch deck, financials, cap table) are in.
    const { data: docs } = await listCompanyDocuments(admin, company.id);
    const dataRoom = computeDataRoomState(docs ?? []);
    if (!dataRoom.coreComplete) {
      return NextResponse.json(
        {
          error: "Complete your data room essentials before listing to investors.",
          missing: dataRoom.coreMissing.map((i) => i.label),
          href: "/founder/readiness/data-room",
        },
        { status: 403 },
      );
    }

    // Ensure slug exists
    const slug = await ensureCompanySlug(admin, {
      id: company.id,
      company_name: company.company_name,
      slug: company.slug,
    });

    const now = new Date().toISOString();
    const { error: updateError } = await admin
      .from("companies")
      .update({
        is_published: true,
        published_at: company.published_at ?? now,
        updated_at: now,
      })
      .eq("id", company.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    track("company_published", { founderId: auth.profile.id, companyId: company.id });
    return NextResponse.json({ slug, is_published: true });
  }

  // unpublish — only if not marketplace-listed (marketplace_visible stays admin-controlled)
  const { error: updateError } = await admin
    .from("companies")
    .update({
      is_published: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", company.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ slug: company.slug, is_published: false });
}
