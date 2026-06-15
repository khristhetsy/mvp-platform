import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireApiProfile } from "@/lib/api/auth";

// pipeline_investors is not yet in generated Supabase types — use untyped client.
function untyped(client: unknown): SupabaseClient {
  return client as SupabaseClient;
}

// Columns returned to founder — contact_email and contact_phone are EXCLUDED
const SAFE_COLUMNS =
  "id,founder_id,name,location,investor_type,investment_size,pledge_amount,interested,meeting_requested,match_score,outreach_status,preferred_stages,focus_sectors,notes,created_at,updated_at";

export async function GET() {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;
  const { supabase, profile } = auth;

  const { data, error } = await untyped(supabase)
    .from("pipeline_investors")
    .select(SAFE_COLUMNS)
    .eq("founder_id", profile.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ investors: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;
  const { supabase, profile } = auth;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const {
    name,
    location,
    investor_type,
    investment_size,
    pledge_amount,
    interested,
    meeting_requested,
    match_score,
    outreach_status,
    preferred_stages,
    focus_sectors,
    notes,
  } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Investor name is required." }, { status: 400 });
  }

  const { data, error } = await untyped(supabase)
    .from("pipeline_investors")
    .insert({
      founder_id: profile.id,
      name: String(name).trim(),
      location: location ?? null,
      investor_type: investor_type ?? "Venture Capital",
      investment_size: investment_size ?? null,
      pledge_amount: pledge_amount ?? null,
      interested: interested ?? false,
      meeting_requested: meeting_requested ?? "none",
      match_score: match_score ?? null,
      outreach_status: outreach_status ?? "not_started",
      preferred_stages: preferred_stages ?? null,
      focus_sectors: focus_sectors ?? null,
      notes: notes ?? null,
    })
    .select(SAFE_COLUMNS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ investor: data }, { status: 201 });
}
