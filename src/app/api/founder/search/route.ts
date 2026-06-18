import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type SearchResult = {
  id: string;
  type: "contact" | "document" | "deal_room" | "investor";
  title: string;
  subtitle: string | null;
  href: string;
};

export async function GET(request: Request) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const supabase = await createServerSupabaseClient();
  const company = await ensureFounderCompanyForUser(auth.profile);
  if (!company) {
    return NextResponse.json({ results: [] });
  }

  const term = `%${q}%`;
  const results: SearchResult[] = [];

  // CRM contacts
  const { data: contacts, error: contactsError } = await supabase
    .from("founder_investor_contacts")
    .select("id, investor_name, firm_name, status")
    .eq("company_id", company.id)
    .or(`investor_name.ilike.${term},firm_name.ilike.${term}`)
    .limit(5);

  if (contactsError) return NextResponse.json({ error: "Query failed" }, { status: 500 });

  for (const c of contacts ?? []) {
    results.push({
      id: c.id,
      type: "contact",
      title: c.investor_name,
      subtitle: c.firm_name ?? c.status ?? null,
      href: "/founder/investors/outreach?tab=crm",
    });
  }

  // Documents
  const { data: docs, error: docsError } = await supabase
    .from("documents")
    .select("id, file_name, document_type, status")
    .eq("company_id", company.id)
    .or(`file_name.ilike.${term},document_type.ilike.${term}`)
    .limit(5);

  if (docsError) return NextResponse.json({ error: "Query failed" }, { status: 500 });

  for (const d of docs ?? []) {
    results.push({
      id: d.id,
      type: "document",
      title: d.file_name ?? d.document_type ?? "Document",
      subtitle: d.document_type ?? d.status ?? null,
      href: "/founder/documents",
    });
  }

  // Deal rooms
  const { data: rooms, error: roomsError } = await supabase
    .from("deal_rooms")
    .select("id, title, status")
    .eq("company_id", company.id)
    .ilike("title", term)
    .limit(3);

  if (roomsError) return NextResponse.json({ error: "Query failed" }, { status: 500 });

  for (const r of rooms ?? []) {
    results.push({
      id: r.id,
      type: "deal_room",
      title: r.title,
      subtitle: r.status ?? null,
      href: `/founder/deal-room/${r.id}`,
    });
  }

  // Pipeline investors (untyped — not in generated schema)
  const untypedSupabase = supabase as unknown as import("@supabase/supabase-js").SupabaseClient;
  const { data: pipelineInvestors, error: pipelineError } = await untypedSupabase
    .from("pipeline_investors")
    .select("id, name, investor_type, outreach_status")
    .eq("founder_id", auth.profile.id)
    .or(`name.ilike.${term},investor_type.ilike.${term}`)
    .limit(5);

  if (pipelineError) return NextResponse.json({ error: "Query failed" }, { status: 500 });

  for (const p of (pipelineInvestors as Array<{ id: string; name: string; investor_type: string | null; outreach_status: string | null }>) ?? []) {
    results.push({
      id: p.id,
      type: "investor",
      title: p.name,
      subtitle: p.investor_type ?? p.outreach_status ?? null,
      href: "/founder/investor-pipeline",
    });
  }

  return NextResponse.json({ results });
}
