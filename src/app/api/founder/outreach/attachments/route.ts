import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireApiProfile } from "@/lib/api/auth";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { onePagerFileName } from "@/lib/outreach/one-pager-pdf";

export const dynamic = "force-dynamic";

/**
 * What the founder can attach to manual outreach: their one pager (PDF and, once
 * published, the online link) and the PDFs in their own data room. Scoped to the
 * active company; nothing from other companies or the investor network.
 */
export async function GET() {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const { company } = await getActiveCompanyForUser(auth.profile);
  if (!company) return NextResponse.json({ onePager: null, documents: [] });

  const db = createServiceRoleClient() as unknown as SupabaseClient;
  const [{ data: comp }, { data: docs }] = await Promise.all([
    db.from("companies").select("company_name, industry, slug, is_published").eq("id", company.id).maybeSingle(),
    db
      .from("documents")
      .select("id, document_type, label, file_name, mime_type, size_bytes, created_at")
      .eq("company_id", company.id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const c = (comp ?? null) as { company_name: string; industry: string | null; slug: string | null; is_published: boolean | null } | null;
  const appBase = (process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com").replace(/\/$/, "");

  const documents = ((docs ?? []) as Array<{
    id: string;
    document_type: string | null;
    label: string | null;
    file_name: string | null;
    mime_type: string | null;
    size_bytes: number | null;
  }>)
    .filter((d) => (d.mime_type ?? "").includes("pdf") || (d.file_name ?? "").toLowerCase().endsWith(".pdf"))
    .map((d) => ({
      id: d.id,
      name: d.label || d.file_name || "Document",
      fileName: d.file_name,
      type: d.document_type,
      sizeBytes: d.size_bytes,
    }));

  return NextResponse.json({
    onePager: c
      ? {
          companyName: c.company_name,
          industry: c.industry,
          fileName: onePagerFileName(c.company_name),
          published: Boolean(c.is_published && c.slug),
          url: c.is_published && c.slug ? `${appBase}/f/${c.slug}` : null,
        }
      : null,
    documents,
  });
}
