import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireApiProfile } from "@/lib/api/auth";

function untyped(client: unknown): SupabaseClient {
  return client as SupabaseClient;
}

export const dynamic = "force-dynamic";

// GET — timestamped notes for one pipeline investor (newest first).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;
  const { supabase, profile } = auth;
  const { id } = await params;

  const { data, error } = await untyped(supabase)
    .from("pipeline_investor_notes")
    .select("id, body, created_at")
    .eq("pipeline_investor_id", id)
    .eq("founder_id", profile.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notes: data ?? [] });
}

// POST — add a note to this pipeline investor.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;
  const { supabase, profile } = auth;
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as { body?: string } | null;
  const text = body?.body?.trim();
  if (!text) return NextResponse.json({ error: "Note text is required." }, { status: 400 });

  // Confirm the investor belongs to this founder before attaching a note.
  const { data: owned } = await untyped(supabase)
    .from("pipeline_investors")
    .select("id")
    .eq("id", id)
    .eq("founder_id", profile.id)
    .maybeSingle();
  if (!owned) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { data, error } = await untyped(supabase)
    .from("pipeline_investor_notes")
    .insert({ pipeline_investor_id: id, founder_id: profile.id, body: text })
    .select("id, body, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ note: data }, { status: 201 });
}
