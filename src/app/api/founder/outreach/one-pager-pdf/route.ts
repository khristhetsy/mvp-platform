import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireApiProfile } from "@/lib/api/auth";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadOnePagerCompany, onePagerFileName, renderOnePagerPdf } from "@/lib/outreach/one-pager-pdf";

export const dynamic = "force-dynamic";

/** The founder's one pager PDF, exactly as it is attached to manual outreach. */
export async function GET() {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const { company } = await getActiveCompanyForUser(auth.profile);
  if (!company) return NextResponse.json({ error: "No company found." }, { status: 404 });

  const db = createServiceRoleClient() as unknown as SupabaseClient;
  const c = await loadOnePagerCompany(db, company.id);
  if (!c) return NextResponse.json({ error: "No company found." }, { status: 404 });

  const appBase = (process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com").replace(/\/$/, "");
  const pdf = await renderOnePagerPdf(c, { onlineUrl: c.is_published && c.slug ? `${appBase}/f/${c.slug}` : null });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${onePagerFileName(c.company_name)}"`,
      "Cache-Control": "no-store",
    },
  });
}
